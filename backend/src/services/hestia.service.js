/**
 * HestiaCP Service
 * Connects to HestiaCP panel API for read-only operations
 */
import https from "https";
import http from "http";
import querystring from "querystring";
import config from "../config/index.js";

/**
 * Parse Hestia's table format response into JSON
 * Uses column positions from header row to correctly extract values
 */
function parseHestiaTable(tableText) {
  const lines = tableText
    .trim()
    .split("\n")
    .filter((line) => line.trim());

  if (lines.length < 2) return [];

  // First line is headers
  const headerLine = lines[0];
  const headers = headerLine.split(/\s+/);

  // Find column positions based on header positions
  const columnPositions = [];
  let currentPos = 0;
  for (const header of headers) {
    const index = headerLine.indexOf(header, currentPos);
    columnPositions.push({ name: header.toLowerCase(), start: index });
    currentPos = index + header.length;
  }

  // Skip separator line (contains only dashes)
  const dataLines = lines.slice(2);

  // Parse each data line using column positions
  return dataLines.map((line) => {
    const obj = {};
    for (let i = 0; i < columnPositions.length; i++) {
      const col = columnPositions[i];
      const nextColPos = i + 1 < columnPositions.length ? columnPositions[i + 1].start : line.length;
      const value = line.substring(col.start, nextColPos).trim();
      obj[col.name] = value || null;
    }
    return obj;
  });
}

export const hestiaService = {
  /**
   * Call HestiaCP API with given command and parameters
   * Supports both traditional user/password and modern API key authentication
   */
  async callHestia(command, params = {}) {
    if (!config.hestia.url) {
      const err = new Error("HestiaCP URL not configured");
      err.status = 502;
      throw err;
    }

    const hasApiKey = config.hestia.apiKey;
    const hasUserPass = config.hestia.username && config.hestia.password;

    if (!hasApiKey && !hasUserPass) {
      const err = new Error(
        "HestiaCP not configured: set either HESTIA_API_KEY or HESTIA_USERNAME + HESTIA_PASSWORD"
      );
      err.status = 502;
      throw err;
    }

    return new Promise((resolve, reject) => {
      const url = new URL(config.hestia.url);
      const protocol = url.protocol === "https:" ? https : http;
      const port = url.port || (url.protocol === "https:" ? 8083 : 8008);

      // Build POST data with required HestiaCP API parameters
      const apiParams = {
        cmd: command,
        ...params,
      };

      // Hestia uses 'hash' parameter for API key authentication
      if (hasApiKey) {
        apiParams.hash = config.hestia.apiKey;
      } else {
        apiParams.user = config.hestia.username;
        apiParams.password = config.hestia.password;
      }

      // Only add returncode for simple status checks, not for data retrieval commands
      // Commands that list data will be parsed from table format
      const dataCommands = ["v-list-users", "v-list-user-domains", "v-list-user-stats"];
      if (!dataCommands.includes(command)) {
        apiParams.returncode = "yes";
      }

      const postData = querystring.stringify(apiParams);

      const options = {
        hostname: url.hostname,
        port: port,
        path: "/api/",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
        rejectUnauthorized: config.hestia.verifySsl === true,
        // Sin esto, un Hestia caído o una red que no responde deja la
        // request colgada indefinidamente. No hay reintento automático:
        // solo se corta y se informa el error al que llamó.
        timeout: 10_000,
      };

      if (process.env.NODE_ENV === "development") {
        const debugUrl = `${config.hestia.url}/api/`;
        const authMode = hasApiKey ? "API_KEY (hash)" : "USER/PASSWORD";
        console.log(`[Hestia] ${command} (${authMode})`);
        console.log(`  URL: ${debugUrl}`);
        const paramLines = postData.split("&").map((p) => {
          const [key, val] = p.split("=");
          if (key === "password" || key === "hash") return `  ${key}=***`;
          return `  ${key}=${val}`;
        });
        console.log(`  Params:\n${paramLines.join("\n")}`);
      }

      const req = protocol.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const contentType = res.headers["content-type"] || "";

            if (process.env.NODE_ENV === "development") {
              console.log(`  Response Status: ${res.statusCode}`);
              console.log(`  Content-Type: ${contentType}`);
              console.log(`  Response (first 500 chars): ${data.substring(0, 500)}`);
            }

            // Handle Hestia returning plain text responses
            if (contentType.includes("text/html")) {
              const trimmed = data.trim();

              // Handle "OK" - success with no data
              if (trimmed === "OK") {
                if (process.env.NODE_ENV === "development") {
                  console.log(`  [Hestia] Response: OK`);
                }
                resolve({ status: "ok", data: [] });
                return;
              }

              // Handle return codes (0=success, 1=error)
              if (trimmed === "0" || trimmed === "1") {
                if (trimmed === "0") {
                  if (process.env.NODE_ENV === "development") {
                    console.log(`  [Hestia] returncode: 0 (OK)`);
                  }
                  resolve({ status: "ok", data: {} });
                  return;
                } else {
                  reject(new Error(`Hestia API returned error code: 1`));
                  return;
                }
              }

              // Handle table format (text/html with header row containing dashes)
              if (data.includes("----")) {
                if (process.env.NODE_ENV === "development") {
                  console.log(`  [Hestia] Parsing table format response`);
                }
                const parsedData = parseHestiaTable(data);
                resolve({ status: "ok", data: parsedData });
                return;
              }
            }

            // Try to parse as JSON
            try {
              const response = JSON.parse(data);
              if (process.env.NODE_ENV === "development") {
                console.log(
                  `[Hestia] response status ${res.statusCode}, ` +
                  `data keys: ${response.data ? Object.keys(response.data).slice(0, 3).join(",") : "none"}`
                );
              }

              if (response.status === "error") {
                reject(new Error(`Hestia API error: ${response.error || "Unknown error"}`));
              } else {
                resolve(response);
              }
            } catch (jsonErr) {
              // If not JSON, return as raw data
              if (process.env.NODE_ENV === "development") {
                console.log(`  [Hestia] Non-JSON response, treating as error or data`);
              }
              reject(new Error(`Failed to parse HestiaCP response: ${jsonErr.message}`));
            }
          } catch (err) {
            reject(new Error(`Failed to parse HestiaCP response: ${err.message}`));
          }
        });
      });

      req.on("error", (err) => {
        reject(new Error(`HestiaCP connection error: ${err.message}`));
      });

      req.on("timeout", () => {
        req.destroy(new Error("HestiaCP request timed out after 10s"));
      });

      req.write(postData);
      req.end();
    });
  },

  /**
   * Test connection to HestiaCP
   */
  async testConnection() {
    try {
      const response = await this.callHestia("v-list-users");
      return {
        connected: response.status !== "error",
        server: config.hestia.url,
        message: "Connected to HestiaCP",
      };
    } catch (err) {
      return {
        connected: false,
        server: config.hestia.url,
        message: err.message,
      };
    }
  },

  /**
   * List all users from HestiaCP
   */
  async listUsers() {
    const response = await this.callHestia("v-list-users");
    if (!response.data) return [];

    // Handle both table format (array) and JSON format (object with arrays)
    if (Array.isArray(response.data)) {
      // Table format from parseHestiaTable
      return response.data.map((row) => ({
        username: row.user || "",
        name: row.user || "",
        email: "",
        package: row.pkg || "default",
        status: "active",
        createdDate: row.date || null,
        login: null,
      }));
    } else {
      // JSON format (legacy, if Hestia ever returns it)
      return Object.entries(response.data).map(([username, userData]) => ({
        username,
        name: userData.NAME?.[0] || username,
        email: userData.EMAIL?.[0] || "",
        package: userData.PACKAGE?.[0] || "default",
        status: userData.STATUS?.[0] || "active",
        createdDate: userData.DATE?.[0] || null,
        login: userData.LOGIN?.[0] || null,
      }));
    }
  },

  /**
   * Get specific user from HestiaCP
   */
  async getUser(username) {
    const response = await this.callHestia("v-list-user", {
      arg1: username,
    });

    if (!response.data || !response.data[username]) {
      const err = new Error(`User ${username} not found in HestiaCP`);
      err.status = 404;
      throw err;
    }

    const userData = response.data[username];
    return {
      username,
      name: userData.NAME?.[0] || username,
      email: userData.EMAIL?.[0] || "",
      package: userData.PACKAGE?.[0] || "default",
      status: userData.STATUS?.[0] || "active",
      createdDate: userData.DATE?.[0] || null,
      login: userData.LOGIN?.[0] || null,
    };
  },

  /**
   * List domains for a user
   */
  async listUserDomains(username) {
    const response = await this.callHestia("v-list-user-domains", {
      arg1: username,
    });

    if (!response.data) return [];

    return Object.entries(response.data).map(([domain, domainData]) => ({
      domain,
      status: domainData.STATUS?.[0] || "active",
      template: domainData.TEMPLATE?.[0] || "",
      ip: domainData.IP?.[0] || "",
      ssl: domainData.SSL?.[0] === "yes",
      sslProvider: domainData.SSL_PROVIDER?.[0] || null,
      createdDate: domainData.DATE?.[0] || null,
    }));
  },

  /**
   * Get user stats (disk usage, etc)
   * Note: Hestia returns a table with historical stats. We take the latest row.
   */
  async getUserStats(username) {
    try {
      const response = await this.callHestia("v-list-user-stats", {
        arg1: username,
      });

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        // No stats available
        return {
          username,
          diskQuota: 0,
          diskUsed: 0,
          bandwidthQuota: 0,
          bandwidthUsed: 0,
          emailAccounts: 0,
          databases: 0,
          backups: 0,
        };
      }

      // Get the latest row (last entry in the table)
      const stats = response.data[response.data.length - 1];
      return {
        username,
        diskQuota: 0,
        diskUsed: parseInt(stats.disk || "0"),
        bandwidthQuota: 0,
        bandwidthUsed: parseInt(stats.bw || "0"),
        emailAccounts: parseInt(stats.mail || "0"),
        databases: parseInt(stats.db || "0"),
        backups: parseInt(stats.backups || "0"),
      };
    } catch (err) {
      // Stats endpoint may not be available, return zeros
      return {
        username,
        diskQuota: 0,
        diskUsed: 0,
        bandwidthQuota: 0,
        bandwidthUsed: 0,
        emailAccounts: 0,
        databases: 0,
        backups: 0,
      };
    }
  },

  /**
   * List mail accounts for a domain
   */
  async listMailAccounts(username, domain) {
    try {
      const response = await this.callHestia("v-list-mail-domain-accounts", {
        arg1: username,
        arg2: domain,
      });

      if (!response.data) return [];

      return Object.entries(response.data)
        .filter(([key]) => key !== "sort")
        .map(([account, accountData]) => ({
          account,
          quota: parseInt(accountData.QUOTA?.[0] || "0"),
          status: accountData.STATUS?.[0] || "active",
        }));
    } catch (err) {
      // Mail accounts endpoint may fail, return empty
      return [];
    }
  },
};
