// Channel-specific configurations
export const CHANNEL_CONFIGS = {
  // TechWithJoshi
  "UC_CHANNEL_ID_1": {
    name: "TechWithJoshi",
    shortName: "TWJ",
    sheetId: process.env.TWJ_SHEET_ID || process.env.SHEET_ID,
    moderators: ["TechWithJoshi", "Joshi"],
    settings: {
      clipDuration: 30, // seconds
      enableAutoClip: true,
      enableChatCommands: true
    }
  },
  
  // Ishita Sharma
  "UC_CHANNEL_ID_2": {
    name: "Ishita Sharma", 
    shortName: "IS",
    sheetId: process.env.IS_SHEET_ID || process.env.SHEET_ID,
    moderators: ["IshitaSharma", "Ishita"],
    settings: {
      clipDuration: 45,
      enableAutoClip: true,
      enableChatCommands: true
    }
  },

  // Default configuration
  "default": {
    name: "Default Channel",
    shortName: "DEF", 
    sheetId: process.env.SHEET_ID,
    moderators: [],
    settings: {
      clipDuration: 30,
      enableAutoClip: true,
      enableChatCommands: true
    }
  }
};

// Get channel config by channel ID or name
export function getChannelConfig(channelId, channelName = null) {
  // Try to find by channel ID first
  if (channelId && CHANNEL_CONFIGS[channelId]) {
    return { 
      ...CHANNEL_CONFIGS[channelId], 
      channelId,
      isConfigured: true 
    };
  }

  // Try to find by channel name
  if (channelName) {
    for (const [id, config] of Object.entries(CHANNEL_CONFIGS)) {
      if (config.name.toLowerCase().includes(channelName.toLowerCase()) ||
          config.shortName.toLowerCase() === channelName.toLowerCase()) {
        return { 
          ...config, 
          channelId: id,
          isConfigured: true 
        };
      }
    }
  }

  // Return default config
  return { 
    ...CHANNEL_CONFIGS.default, 
    channelId: channelId || "unknown",
    channelName: channelName || "Unknown Channel",
    isConfigured: false 
  };
}

// Add new channel configuration
export function addChannelConfig(channelId, config) {
  CHANNEL_CONFIGS[channelId] = {
    ...CHANNEL_CONFIGS.default,
    ...config
  };
  return CHANNEL_CONFIGS[channelId];
}

// Update existing channel configuration  
export function updateChannelConfig(channelId, updates) {
  if (CHANNEL_CONFIGS[channelId]) {
    CHANNEL_CONFIGS[channelId] = {
      ...CHANNEL_CONFIGS[channelId],
      ...updates
    };
    return CHANNEL_CONFIGS[channelId];
  }
  return null;
}

// Get sheet ID for channel
export function getSheetIdForChannel(channelId, channelName = null) {
  const config = getChannelConfig(channelId, channelName);
  return config.sheetId;
}

// Check if user is moderator for channel
export function isChannelModerator(channelId, channelName, username) {
  const config = getChannelConfig(channelId, channelName);
  return config.moderators.some(mod => 
    mod.toLowerCase() === username.toLowerCase()
  );
}
