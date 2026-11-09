// prismarine-physics checks liquid-gravity support by major-version label.
// Minecraft 26.3 is missing from its feature list, although it uses the
// proportional liquid-gravity rule introduced for the 26.x releases.
const physicsFeatures = require('prismarine-physics/lib/features');
const proportionalLiquidGravity = physicsFeatures.find(
  feature => feature.name === 'proportionalLiquidGravity'
);
if (proportionalLiquidGravity && !proportionalLiquidGravity.versions.includes('26.3')) {
  proportionalLiquidGravity.versions.push('26.3');
}

const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const fs = require('fs');
const { getAIResponse } = require('./ai_assistant');
const express = require('express');

const app = express();
app.use(express.json());

let config = {};
try {
  config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch (err) {
  console.error('Error reading config.json:', err.message);
  console.log('Using default configuration...');
  config = {
    server: {
      host: 'localhost',
      port: 25565,
      version: false,
      auth: 'offline'
    },
    bots: [
      { username: 'AFKBot1', movementInterval: 30000 },
      { username: 'AFKBot2', movementInterval: 35000 },
      { username: 'AFKBot3', movementInterval: 40000 },
      { username: 'AFKBot4', movementInterval: 45000 },
      { username: 'AFKBot5', movementInterval: 50000 },
      { username: 'AFKBot5', movementInterval: 50000 }
    ],
    autoReconnect: true,
    reconnectDelay: 6000
  };
}

let isShuttingDown = false;
const botInstances = [];

class BotInstance {
  constructor(botConfig, serverConfig, globalConfig) {
    this.username = botConfig.username;
    this.movementInterval = botConfig.movementInterval;
    this.chatMessage = botConfig.chatMessage;
    this.chatInterval = botConfig.chatInterval;
    this.serverConfig = serverConfig;
    this.globalConfig = globalConfig;
    this.bot = null;
    this.movementTimer = null;
    this.chatTimer = null;
    this.reconnectTimer = null;
  }

  log(message) {
    console.log(`[${this.username}] ${message}`);
  }

  createBot() {
    if (isShuttingDown) return;

    this.log(`Connecting to ${this.serverConfig.host}:${this.serverConfig.port}...`);

    try {
      this.bot = mineflayer.createBot({
        host: this.serverConfig.host,
        port: this.serverConfig.port,
        username: this.username,
        version: this.serverConfig.version,
        auth: this.serverConfig.auth,
        hideErrors: true
      });

      this.bot.loadPlugin(pathfinder);

      this.bot.on('login', () => {
        this.log(`✓ Successfully logged in`);
      });

      this.bot.on('spawn', () => {
        this.log(`✓ Spawned in the world at ${this.bot.entity.position}`);
        this.startAFKActivities();
      });

      this.bot.on('chat', async (username, message) => {
        if (username === this.username) return;
        this.log(`[Chat] <${username}> ${message}`);

        if (this.username.toLowerCase() === 'azan2') {
          if (message.toLowerCase().includes('follow me')) {
            const player = this.bot.players[username];
            if (player && player.entity) {
              this.log(`Following ${username}`);
              const { GoalFollow } = require('mineflayer-pathfinder').goals;
              this.bot.pathfinder.setGoal(new GoalFollow(player.entity, 1), true);
            } else {
              this.bot.chat("I can't see you!");
            }
          } else if (message.toLowerCase().includes('stop')) {
            this.log(`Stopped action`);
            this.bot.pathfinder.setGoal(null);
          } else if (message.toLowerCase().includes('sleep')) {
            const bed = this.bot.findBlock({
              matching: block => this.bot.isABed(block),
              maxDistance: 32
            });
            if (bed) {
              this.log(`Attempting to sleep in bed at ${bed.position}`);
              this.bot.sleep(bed).catch(err => {
                this.bot.chat(`I can't sleep right now: ${err.message}`);
              });
            } else {
              this.bot.chat("I can't find a bed nearby!");
            }
          } else if (message.toLowerCase().startsWith('mine ')) {
            this.bot.chat("Mining system is currently being optimized. Please try 'follow me' for now!");
          }
        }

        if (message.toLowerCase().includes(this.username.toLowerCase())) {
          const aiResponse = await getAIResponse(username, message);
          this.bot.chat(aiResponse);
        }
      });

      this.bot.on('kicked', (reason) => {
        const kickReason = typeof reason === 'string' ? reason : JSON.stringify(reason);
        this.log(`✕ Kicked: ${kickReason}`);
        this.stopAFKActivities();
        this.handleDisconnect();
      });

      this.bot.on('error', (err) => {
        this.log(`✕ Error: ${err.message}`);
        this.stopAFKActivities();
        this.handleDisconnect();
      });

      this.bot.on('end', () => {
        this.log(`✕ Disconnected`);
        this.stopAFKActivities();
        this.handleDisconnect();
      });

      this.bot.on('death', () => {
        this.log(`💀 Died! Respawning...`);
      });

      this.bot.on('health', () => {
        if (this.bot.health <= 5) {
          this.log(`⚠️ Low health: ${this.bot.health}/20`);
        }
      });
    } catch (err) {
      this.log(`✕ Failed to create bot: ${err.message}`);
      this.handleDisconnect();
    }
  }

  startAFKActivities() {
    this.stopAFKActivities();

    this.movementTimer = setInterval(() => {
      if (this.bot && this.bot.entity) {
        this.bot.setControlState('jump', true);
        setTimeout(() => {
          if (this.bot && this.bot.entity) this.bot.setControlState('jump', false);
        }, 500);
      }
      this.performAFKAction();
    }, this.movementInterval);

    if (this.chatMessage && this.chatInterval) {
      this.chatTimer = setInterval(() => {
        this.sendChatMessage();
      }, this.chatInterval);
    }

    this.log(`✓ AFK mode active (action every ${this.movementInterval / 1000}s with Anti-Idle Jump)`);
  }

  stopAFKActivities() {
    if (this.movementTimer) {
      clearInterval(this.movementTimer);
      this.movementTimer = null;
    }
    if (this.chatTimer) {
      clearInterval(this.chatTimer);
      this.chatTimer = null;
    }
  }

  performAFKAction() {
    if (!this.bot || !this.bot.entity) {
      return;
    }
    try {
      const pos = this.bot.entity.position;
    } catch (err) {
      this.log(`Error performing action: ${err.message}`);
    }
  }

  sendChatMessage() {
    if (!this.bot) {
      return;
    }
    try {
      this.bot.chat(this.chatMessage);
      this.log(`💬 Sent: "${this.chatMessage}"`);
    } catch (err) {
      this.log(`Error sending chat: ${err.message}`);
    }
  }

  handleDisconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (isShuttingDown) {
      return;
    }
    if (this.globalConfig.autoReconnect) {
      this.log(`Reconnecting in ${this.globalConfig.reconnectDelay / 1000}s...`);
      this.reconnectTimer = setTimeout(() => {
        this.createBot();
      }, this.globalConfig.reconnectDelay);
    }
  }

  shutdown() {
    this.stopAFKActivities();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.bot) {
      this.bot.quit();
    }
  }
}

// Web API Endpoints
app.get('/status', (req, res) => {
  const status = botInstances.map(bot => ({
    username: bot.username,
    connected: bot.bot && bot.bot.entity ? true : false,
    health: bot.bot ? bot.bot.health : null,
    position: bot.bot && bot.bot.entity ? bot.bot.entity.position.toString() : null
  }));
  res.json({ bots: status, total: botInstances.length });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', botsRunning: botInstances.length });
});

// PEHLE SERVER START KAREIN (Taki free hosting deploy fail na kare)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✓ Web endpoint enabled on port ${PORT}`);
  console.log(`  Status: http://localhost:${PORT}/status`);
  console.log(`  Health: http://localhost:${PORT}/health\n`);

  console.log(`\n=== Minecraft Multi-Bot AFK System ===`);
  console.log(`Server: ${config.server.host}:${config.server.port}`);
  console.log(`Version: ${config.server.version || 'auto-detect'}`);
  console.log(`Starting ${config.bots.length} bots...\n`);

  config.bots.forEach((botConfig, index) => {
    const botInstance = new BotInstance(botConfig, config.server, config);
    botInstances.push(botInstance);

    setTimeout(() => {
      botInstance.createBot();
    }, 20000 + (index * 20000));
  });
});

process.on('SIGINT', () => {
  console.log(`\n\nShutting down all bots gracefully...`);
  isShuttingDown = true;
  botInstances.forEach(instance => {
    instance.shutdown();
  });
  setTimeout(() => process.exit(0), 2000);
});
