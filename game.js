import React, { useEffect, useRef } from 'react';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  INVENTORY_SLOTS: 15,
  BASE_STAT_POINTS: 3,
  XP_CURVE_MULTIPLIER: 100,
  ESCAPE_BASE_CHANCE: 0.3
};

const GAME_STATES = {
  MENU: 'MENU',
  EXPLORING: 'EXPLORING',
  COMBAT: 'COMBAT',
  SCENARIO: 'SCENARIO',
  INVENTORY: 'INVENTORY',
  LEVEL_UP: 'LEVEL_UP',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const randomChoice = (array) => array[Math.floor(Math.random() * array.length)];

const calculateXPForLevel = (level) => Math.floor(CONFIG.XP_CURVE_MULTIPLIER * Math.pow(level, 1.5));

// ============================================================================
// ITEM SYSTEM
// ============================================================================

class Item {
  constructor(name, type, description, effect) {
    this.name = name;
    this.type = type; // weapon, armor, consumable, artifact
    this.description = description;
    this.effect = effect; // { stat: value } or function
  }

  use(player) {
    if (this.type === 'consumable' && typeof this.effect === 'function') {
      return this.effect(player);
    }
    return false;
  }
}

const ITEM_TEMPLATES = {
  // Weapons
  rustyDagger: new Item('Rusty Dagger', 'weapon', 'A worn blade', { strength: 2 }),
  ironSword: new Item('Iron Sword', 'weapon', 'A reliable weapon', { strength: 5 }),
  flameBlade: new Item('Flame Blade', 'weapon', 'Burns with inner fire', { strength: 8, intelligence: 3 }),
  shadowDagger: new Item('Shadow Dagger', 'weapon', 'Strikes from darkness', { strength: 6, agility: 4 }),
  
  // Armor
  leatherArmor: new Item('Leather Armor', 'armor', 'Basic protection', { defense: 3 }),
  chainmail: new Item('Chainmail', 'armor', 'Solid metal links', { defense: 6 }),
  crystalPlate: new Item('Crystal Plate', 'armor', 'Magical protection', { defense: 8, intelligence: 2 }),
  
  // Consumables
  healthPotion: new Item('Health Potion', 'consumable', 'Restores 30 HP', (player) => {
    player.health = Math.min(player.maxHealth, player.health + 30);
    return `Restored 30 HP`;
  }),
  strengthElixir: new Item('Strength Elixir', 'consumable', 'Temporarily +5 STR', (player) => {
    player.tempStats.strength = (player.tempStats.strength || 0) + 5;
    return `Strength increased by 5`;
  }),
  
  // Artifacts
  luckyCoin: new Item('Lucky Coin', 'artifact', 'Improves fortune', { agility: 2 }),
  ancientTome: new Item('Ancient Tome', 'artifact', 'Contains knowledge', { intelligence: 4 })
};

class Inventory {
  constructor(maxSlots = CONFIG.INVENTORY_SLOTS) {
    this.items = [];
    this.maxSlots = maxSlots;
    this.equipped = {
      weapon: null,
      armor: null,
      artifact: null
    };
  }

  addItem(item) {
    if (this.items.length >= this.maxSlots) {
      return false;
    }
    this.items.push(item);
    return true;
  }

  removeItem(item) {
    const index = this.items.indexOf(item);
    if (index > -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  equip(item) {
    if (!this.items.includes(item)) return false;
    
    const slot = item.type === 'weapon' ? 'weapon' : 
                 item.type === 'armor' ? 'armor' : 
                 item.type === 'artifact' ? 'artifact' : null;
    
    if (slot) {
      if (this.equipped[slot]) {
        this.addItem(this.equipped[slot]);
      }
      this.equipped[slot] = item;
      this.removeItem(item);
      return true;
    }
    return false;
  }

  unequip(slot) {
    if (this.equipped[slot]) {
      const item = this.equipped[slot];
      this.equipped[slot] = null;
      this.addItem(item);
      return true;
    }
    return false;
  }

  getEquippedStats() {
    const stats = { strength: 0, defense: 0, agility: 0, intelligence: 0 };
    Object.values(this.equipped).forEach(item => {
      if (item && item.effect && typeof item.effect === 'object') {
        Object.keys(item.effect).forEach(stat => {
          stats[stat] = (stats[stat] || 0) + item.effect[stat];
        });
      }
    });
    return stats;
  }
}

// ============================================================================
// PLAYER CLASS
// ============================================================================

class Player {
  constructor() {
    this.level = 1;
    this.xp = 0;
    this.health = 100;
    this.maxHealth = 100;
    
    // Base stats
    this.baseStats = {
      strength: 5,
      defense: 5,
      agility: 5,
      intelligence: 5
    };
    
    this.statPoints = 0;
    this.tempStats = {}; // For buffs
    this.inventory = new Inventory();
    
    // Starting equipment
    this.inventory.addItem(ITEM_TEMPLATES.rustyDagger);
    this.inventory.addItem(ITEM_TEMPLATES.healthPotion);
  }

  getTotalStats() {
    const equipped = this.inventory.getEquippedStats();
    const total = {};
    
    Object.keys(this.baseStats).forEach(stat => {
      total[stat] = this.baseStats[stat] + 
                    (equipped[stat] || 0) + 
                    (this.tempStats[stat] || 0);
    });
    
    return total;
  }

  addXP(amount) {
    this.xp += amount;
    const xpNeeded = calculateXPForLevel(this.level + 1);
    
    if (this.xp >= xpNeeded) {
      this.levelUp();
      return true;
    }
    return false;
  }

  levelUp() {
    this.level++;
    this.statPoints += CONFIG.BASE_STAT_POINTS;
    
    // Increase base stats
    this.baseStats.strength += 1;
    this.baseStats.defense += 1;
    this.baseStats.agility += 1;
    this.baseStats.intelligence += 1;
    
    // Increase max health
    this.maxHealth += 10;
    this.health = this.maxHealth;
  }

  allocateStat(stat) {
    if (this.statPoints > 0 && this.baseStats.hasOwnProperty(stat)) {
      this.baseStats[stat] += 1;
      this.statPoints--;
      return true;
    }
    return false;
  }

  takeDamage(amount) {
    const stats = this.getTotalStats();
    const reduction = Math.floor(stats.defense * 0.5);
    const damage = Math.max(1, amount - reduction);
    this.health = Math.max(0, this.health - damage);
    return damage;
  }

  calculateDamage() {
    const stats = this.getTotalStats();
    const baseDamage = stats.strength * 2;
    const variance = randomInt(-2, 3);
    return Math.max(1, baseDamage + variance);
  }

  calculateSpecialDamage() {
    const stats = this.getTotalStats();
    const baseDamage = stats.strength + stats.intelligence * 1.5;
    const variance = randomInt(-3, 5);
    return Math.max(1, Math.floor(baseDamage + variance));
  }

  getDodgeChance() {
    const stats = this.getTotalStats();
    return Math.min(0.4, stats.agility * 0.02);
  }

  isAlive() {
    return this.health > 0;
  }
}

// ============================================================================
// ENEMY CLASS
// ============================================================================

class Enemy {
  constructor(name, level, type, stats) {
    this.name = name;
    this.level = level;
    this.type = type; // light, shadow
    this.maxHealth = stats.health;
    this.health = stats.health;
    this.strength = stats.strength;
    this.defense = stats.defense;
    this.agility = stats.agility;
    this.xpReward = stats.xpReward;
    this.loot = stats.loot || [];
  }

  takeDamage(amount) {
    const reduction = Math.floor(this.defense * 0.5);
    const damage = Math.max(1, amount - reduction);
    this.health = Math.max(0, this.health - damage);
    return damage;
  }

  calculateDamage() {
    const baseDamage = this.strength * 1.5;
    const variance = randomInt(-2, 2);
    return Math.max(1, Math.floor(baseDamage + variance));
  }

  getDodgeChance() {
    return Math.min(0.3, this.agility * 0.015);
  }

  chooseAction(player) {
    // Simple AI: attack more when player is low, special when high
    const playerHealthPercent = player.health / player.maxHealth;
    const rand = Math.random();
    
    if (playerHealthPercent < 0.3 && rand < 0.7) {
      return 'attack';
    } else if (playerHealthPercent > 0.7 && rand < 0.3) {
      return 'special';
    } else {
      return 'attack';
    }
  }

  isAlive() {
    return this.health > 0;
  }
}

const ENEMY_TEMPLATES = {
  // Light Path Enemies
  goblin: (level) => new Enemy('Goblin', level, 'light', {
    health: 30 + level * 5,
    strength: 3 + level,
    defense: 2 + level,
    agility: 4 + level,
    xpReward: 20 + level * 5,
    loot: [ITEM_TEMPLATES.healthPotion]
  }),
  
  knight: (level) => new Enemy('Corrupted Knight', level, 'light', {
    health: 50 + level * 8,
    strength: 6 + level * 2,
    defense: 5 + level * 2,
    agility: 2 + level,
    xpReward: 40 + level * 8,
    loot: [ITEM_TEMPLATES.ironSword, ITEM_TEMPLATES.chainmail]
  }),
  
  lightGuardian: (level) => new Enemy('Light Guardian', level, 'light', {
    health: 80 + level * 10,
    strength: 8 + level * 2,
    defense: 6 + level * 2,
    agility: 3 + level,
    xpReward: 60 + level * 10,
    loot: [ITEM_TEMPLATES.flameBlade, ITEM_TEMPLATES.crystalPlate]
  }),
  
  // Shadow Path Enemies
  shadowBeast: (level) => new Enemy('Shadow Beast', level, 'shadow', {
    health: 35 + level * 6,
    strength: 5 + level * 1.5,
    defense: 3 + level,
    agility: 6 + level * 1.5,
    xpReward: 25 + level * 6,
    loot: [ITEM_TEMPLATES.healthPotion, ITEM_TEMPLATES.luckyCoin]
  }),
  
  darkMage: (level) => new Enemy('Dark Mage', level, 'shadow', {
    health: 40 + level * 7,
    strength: 4 + level,
    defense: 3 + level,
    agility: 5 + level,
    xpReward: 45 + level * 9,
    loot: [ITEM_TEMPLATES.ancientTome, ITEM_TEMPLATES.strengthElixir]
  }),
  
  shadowLord: (level) => new Enemy('Shadow Lord', level, 'shadow', {
    health: 100 + level * 12,
    strength: 10 + level * 2.5,
    defense: 7 + level * 2,
    agility: 8 + level * 2,
    xpReward: 80 + level * 15,
    loot: [ITEM_TEMPLATES.shadowDagger, ITEM_TEMPLATES.ancientTome]
  })
};

// ============================================================================
// COMBAT SYSTEM
// ============================================================================

class CombatSystem {
  constructor() {
    this.combatLog = [];
    this.playerTurn = true;
    this.turnCount = 0;
  }

  startCombat(player, enemy) {
    this.combatLog = [];
    this.playerTurn = true;
    this.turnCount = 0;
    this.addLog(`Combat started with ${enemy.name}!`);
    
    // Determine first turn based on agility
    const playerStats = player.getTotalStats();
    if (enemy.agility > playerStats.agility) {
      this.playerTurn = false;
      this.addLog(`${enemy.name} strikes first!`);
    }
  }

  addLog(message) {
    this.combatLog.push(message);
    if (this.combatLog.length > 8) {
      this.combatLog.shift();
    }
  }

  playerAttack(player, enemy) {
    const damage = player.calculateDamage();
    
    if (Math.random() < enemy.getDodgeChance()) {
      this.addLog(`${enemy.name} dodged your attack!`);
      return { hit: false, damage: 0 };
    }
    
    const actualDamage = enemy.takeDamage(damage);
    this.addLog(`You dealt ${actualDamage} damage to ${enemy.name}!`);
    return { hit: true, damage: actualDamage };
  }

  playerSpecialAttack(player, enemy) {
    const damage = player.calculateSpecialDamage();
    
    if (Math.random() < enemy.getDodgeChance() * 0.5) {
      this.addLog(`${enemy.name} dodged your special attack!`);
      return { hit: false, damage: 0 };
    }
    
    const actualDamage = enemy.takeDamage(damage);
    this.addLog(`Your special attack dealt ${actualDamage} damage!`);
    return { hit: true, damage: actualDamage };
  }

  enemyTurn(player, enemy) {
    const action = enemy.chooseAction(player);
    
    if (action === 'special') {
      const damage = Math.floor(enemy.calculateDamage() * 1.5);
      
      if (Math.random() < player.getDodgeChance() * 0.7) {
        this.addLog(`You dodged ${enemy.name}'s special attack!`);
        return { hit: false, damage: 0 };
      }
      
      const actualDamage = player.takeDamage(damage);
      this.addLog(`${enemy.name}'s special attack dealt ${actualDamage} damage!`);
      return { hit: true, damage: actualDamage };
    } else {
      const damage = enemy.calculateDamage();
      
      if (Math.random() < player.getDodgeChance()) {
        this.addLog(`You dodged ${enemy.name}'s attack!`);
        return { hit: false, damage: 0 };
      }
      
      const actualDamage = player.takeDamage(damage);
      this.addLog(`${enemy.name} dealt ${actualDamage} damage!`);
      return { hit: true, damage: actualDamage };
    }
  }

  attemptEscape(player, enemy) {
    const playerStats = player.getTotalStats();
    const escapeChance = CONFIG.ESCAPE_BASE_CHANCE + (playerStats.agility * 0.02);
    
    if (Math.random() < escapeChance) {
      this.addLog("You successfully escaped!");
      return true;
    } else {
      this.addLog("Escape failed!");
      return false;
    }
  }

  endTurn() {
    this.playerTurn = !this.playerTurn;
    this.turnCount++;
  }
}

// ============================================================================
// SCENARIO SYSTEM
// ============================================================================

class Scenario {
  constructor(title, description, choices) {
    this.title = title;
    this.description = description;
    this.choices = choices; // [{ text, action, result }]
  }
}

const SCENARIOS = {
  // Starting scenario
  entrance: new Scenario(
    'The Dungeon Entrance',
    'You stand before a massive dungeon entrance. Two paths stretch before you: a bright corridor filled with golden light, and a dark passage shrouded in shadow.',
    [
      {
        text: 'Take the Path of Light',
        action: (game) => {
          game.player.chosenPath = 'light';
          game.scenarioManager.currentPath = 'light';
          return 'You step into the radiant corridor. The air feels warm and holy.';
        }
      },
      {
        text: 'Take the Path of Shadow',
        action: (game) => {
          game.player.chosenPath = 'shadow';
          game.scenarioManager.currentPath = 'shadow';
          return 'You enter the darkness. Cold whispers echo around you.';
        }
      }
    ]
  ),
  
  // Light Path Scenarios
  lightShrine: new Scenario(
    'Ancient Shrine',
    'You discover a shrine bathed in light. An offering bowl sits before a statue.',
    [
      {
        text: 'Offer a prayer (costs 10 HP)',
        action: (game) => {
          game.player.health = Math.max(1, game.player.health - 10);
          game.player.baseStats.intelligence += 2;
          return 'The shrine glows. You feel enlightened! +2 Intelligence';
        }
      },
      {
        text: 'Search for treasure',
        action: (game) => {
          if (Math.random() < 0.6) {
            game.player.inventory.addItem(ITEM_TEMPLATES.healthPotion);
            return 'You found a Health Potion!';
          } else {
            return 'You found nothing of value.';
          }
        }
      },
      {
        text: 'Continue forward',
        action: (game) => 'You press onward.'
      }
    ]
  ),
  
  lightTreasure: new Scenario(
    'Golden Chamber',
    'A room filled with treasures! But they may be cursed...',
    [
      {
        text: 'Take the golden sword',
        action: (game) => {
          game.player.inventory.addItem(ITEM_TEMPLATES.flameBlade);
          return 'You obtained the Flame Blade!';
        }
      },
      {
        text: 'Take the armor',
        action: (game) => {
          game.player.inventory.addItem(ITEM_TEMPLATES.crystalPlate);
          return 'You obtained Crystal Plate!';
        }
      },
      {
        text: 'Leave it alone',
        action: (game) => {
          game.player.addXP(30);
          return 'Wisely, you resist greed. +30 XP';
        }
      }
    ]
  ),
  
  // Shadow Path Scenarios
  shadowRitual: new Scenario(
    'Ritual Chamber',
    'Dark symbols cover the walls. A ritual circle pulses with energy.',
    [
      {
        text: 'Step into the circle',
        action: (game) => {
          const damage = randomInt(10, 20);
          game.player.health = Math.max(1, game.player.health - damage);
          game.player.baseStats.strength += 3;
          return `Dark energy courses through you! -${damage} HP, +3 Strength`;
        }
      },
      {
        text: 'Study the symbols',
        action: (game) => {
          game.player.baseStats.intelligence += 2;
          game.player.inventory.addItem(ITEM_TEMPLATES.ancientTome);
          return 'You decipher ancient knowledge. +2 Intelligence, gained Ancient Tome';
        }
      },
      {
        text: 'Destroy the circle',
        action: (game) => {
          game.player.addXP(40);
          return 'You disrupt the dark magic. +40 XP';
        }
      }
    ]
  ),
  
  shadowAmbush: new Scenario(
    'Dark Ambush',
    'Shadows move unnaturally. You sense danger!',
    [
      {
        text: 'Prepare for combat',
        action: (game) => {
          game.player.tempStats.defense = (game.player.tempStats.defense || 0) + 3;
          return 'You brace yourself. +3 Defense temporarily';
        }
      },
      {
        text: 'Use stealth (requires 10+ Agility)',
        action: (game) => {
          const stats = game.player.getTotalStats();
          if (stats.agility >= 10) {
            game.player.addXP(50);
            return 'You slip past unseen. +50 XP';
          } else {
            return 'You lack the agility! Combat begins...';
          }
        }
      },
      {
        text: 'Charge forward',
        action: (game) => 'You rush ahead recklessly!'
      }
    ]
  )
};

class ScenarioManager {
  constructor() {
    this.currentPath = null;
    this.scenarioIndex = 0;
    this.currentScenario = SCENARIOS.entrance;
    
    this.lightPathSequence = [
      'lightShrine',
      'combat',
      'lightTreasure',
      'combat',
      'bossCombat'
    ];
    
    this.shadowPathSequence = [
      'shadowRitual',
      'combat',
      'shadowAmbush',
      'combat',
      'bossCombat'
    ];
  }

  getNextScenario(game) {
    if (!this.currentPath) {
      return SCENARIOS.entrance;
    }
    
    const sequence = this.currentPath === 'light' ? this.lightPathSequence : this.shadowPathSequence;
    
    if (this.scenarioIndex >= sequence.length) {
      return null; // Game complete
    }
    
    const scenarioType = sequence[this.scenarioIndex];
    this.scenarioIndex++;
    
    if (scenarioType === 'combat') {
      return this.createCombatScenario(game);
    } else if (scenarioType === 'bossCombat') {
      return this.createBossScenario(game);
    } else {
      return SCENARIOS[scenarioType];
    }
  }

  createCombatScenario(game) {
    const enemyType = this.currentPath === 'light' ? 
      randomChoice(['goblin', 'knight']) : 
      randomChoice(['shadowBeast', 'darkMage']);
    
    const enemy = ENEMY_TEMPLATES[enemyType](game.player.level);
    
    return {
      title: 'Enemy Encounter!',
      description: `A ${enemy.name} blocks your path!`,
      combat: true,
      enemy: enemy
    };
  }

  createBossScenario(game) {
    const bossType = this.currentPath === 'light' ? 'lightGuardian' : 'shadowLord';
    const boss = ENEMY_TEMPLATES[bossType](game.player.level + 1);
    
    return {
      title: 'BOSS BATTLE!',
      description: `The ${boss.name} emerges!`,
      combat: true,
      enemy: boss,
      isBoss: true
    };
  }

  reset() {
    this.currentPath = null;
    this.scenarioIndex = 0;
    this.currentScenario = SCENARIOS.entrance;
  }
}

// ============================================================================
// GAME CLASS
// ============================================================================

class Game {
  constructor(canvasRef) {
    this.canvas = canvasRef;
    this.ctx = this.canvas.getContext('2d');
    this.state = GAME_STATES.MENU;
    
    this.player = new Player();
    this.combatSystem = new CombatSystem();
    this.scenarioManager = new ScenarioManager();
    
    this.currentEnemy = null;
    this.currentScenario = null;
    this.selectedOption = 0;
    this.inventorySelection = 0;
    this.statSelection = 0;
    
    this.keys = {};
    this.lastKeyPress = 0;
    this.keyDelay = 200;
    
    this.messageLog = [];
    this.gameResult = null;
  }

  addMessage(msg) {
    this.messageLog.push(msg);
    if (this.messageLog.length > 5) {
      this.messageLog.shift();
    }
  }

  handleKeyPress(key) {
    const now = Date.now();
    if (now - this.lastKeyPress < this.keyDelay) return;
    this.lastKeyPress = now;
    
    if (this.state === GAME_STATES.MENU) {
      if (key === 'Enter') {
        this.startGame();
      }
    } else if (this.state === GAME_STATES.EXPLORING) {
      if (key === 'i' || key === 'I') {
        this.state = GAME_STATES.INVENTORY;
        this.inventorySelection = 0;
      }
    } else if (this.state === GAME_STATES.SCENARIO) {
      this.handleScenarioInput(key);
    } else if (this.state === GAME_STATES.COMBAT) {
      this.handleCombatInput(key);
    } else if (this.state === GAME_STATES.INVENTORY) {
      this.handleInventoryInput(key);
    } else if (this.state === GAME_STATES.LEVEL_UP) {
      this.handleLevelUpInput(key);
    } else if (this.state === GAME_STATES.GAME_OVER || this.state === GAME_STATES.VICTORY) {
      if (key === 'Enter') {
        this.reset();
      }
    }
  }

  handleScenarioInput(key) {
    if (!this.currentScenario) return;
    
    if (this.currentScenario.combat) {
      if (key === 'Enter') {
        this.startCombat(this.currentScenario.enemy);
      }
      return;
    }
    
    const choices = this.currentScenario.choices;
    
    if (key === 'ArrowUp') {
      this.selectedOption = Math.max(0, this.selectedOption - 1);
    } else if (key === 'ArrowDown') {
      this.selectedOption = Math.min(choices.length - 1, this.selectedOption + 1);
    } else if (key === 'Enter') {
      const choice = choices[this.selectedOption];
      const result = choice.action(this);
      this.addMessage(result);
      this.selectedOption = 0;
      this.proceedToNextScenario();
    }
  }

  handleCombatInput(key) {
    if (!this.combatSystem.playerTurn) return;
    
    const options = ['Attack', 'Special Attack', 'Use Item', 'Escape'];
    
    if (key === 'ArrowUp') {
      this.selectedOption = Math.max(0, this.selectedOption - 1);
    } else if (key === 'ArrowDown') {
      this.selectedOption = Math.min(options.length - 1, this.selectedOption + 1);
    } else if (key === 'Enter') {
      this.executeCombatAction(this.selectedOption);
    }
  }

  handleInventoryInput(key) {
    const allItems = [...this.player.inventory.items];
    
    if (key === 'ArrowUp') {
      this.inventorySelection = Math.max(0, this.inventorySelection - 1);
    } else if (key === 'ArrowDown') {
      this.inventorySelection = Math.min(allItems.length - 1, this.inventorySelection + 1);
    } else if (key === 'Enter') {
      const item = allItems[this.inventorySelection];
      if (item) {
        if (item.type === 'consumable') {
          const result = item.use(this.player);
          if (result) {
            this.addMessage(result);
            this.player.inventory.removeItem(item);
          }
        } else {
          this.player.inventory.equip(item);
          this.addMessage(`Equipped ${item.name}`);
        }
      }
    } else if (key === 'Escape' || key === 'i' || key === 'I') {
      this.state = GAME_STATES.EXPLORING;
    }
  }

  handleLevelUpInput(key) {
    const stats = ['strength', 'defense', 'agility', 'intelligence'];
    
    if (this.player.statPoints === 0) {
      if (key === 'Enter') {
        this.state = GAME_STATES.EXPLORING;
      }
      return;
    }
    
    if (key === 'ArrowUp') {
      this.statSelection = Math.max(0, this.statSelection - 1);
    } else if (key === 'ArrowDown') {
      this.statSelection = Math.min(stats.length - 1, this.statSelection + 1);
    } else if (key === 'Enter') {
      this.player.allocateStat(stats[this.statSelection]);
      this.addMessage(`+1 ${stats[this.statSelection]}`);
      if (this.player.statPoints === 0) {
        this.addMessage('All stat points allocated!');
      }
    }
  }

  executeCombatAction(actionIndex) {
    switch(actionIndex) {
      case 0: // Attack
        this.combatSystem.playerAttack(this.player, this.currentEnemy);
        this.combatSystem.endTurn();
        break;
      case 1: // Special Attack
        this.combatSystem.playerSpecialAttack(this.player, this.currentEnemy);
        this.combatSystem.endTurn();
        break;
      case 2: // Use Item
        this.state = GAME_STATES.INVENTORY;
        this.inventorySelection = 0;
        return;
      case 3: // Escape
        if (this.combatSystem.attemptEscape(this.player, this.currentEnemy)) {
          this.endCombat(false);
          return;
        }
        this.combatSystem.endTurn();
        break;
    }
    
    this.checkCombatEnd();
  }

  checkCombatEnd() {
    if (!this.currentEnemy.isAlive()) {
      this.endCombat(true);
    } else if (!this.player.isAlive()) {
      this.gameOver();
    } else if (!this.combatSystem.playerTurn) {
      setTimeout(() => {
        this.combatSystem.enemyTurn(this.player, this.currentEnemy);
        this.combatSystem.endTurn();
        this.checkCombatEnd();
      }, 800);
    }
  }

  startCombat(enemy) {
    this.currentEnemy = enemy;
    this.combatSystem.startCombat(this.player, enemy);
    this.state = GAME_STATES.COMBAT;
    this.selectedOption = 0;
  }

  endCombat(victory) {
    if (victory) {
      const xpGained = this.currentEnemy.xpReward;
      this.addMessage(`Victory! +${xpGained} XP`);
      
      const leveledUp = this.player.addXP(xpGained);
      
      if (this.currentEnemy.loot.length > 0) {
        const loot = randomChoice(this.currentEnemy.loot);
        if (this.player.inventory.addItem(loot)) {
          this.addMessage(`Found: ${loot.name}`);
        }
      }
      
      if (leveledUp) {
        this.state = GAME_STATES.LEVEL_UP;
        this.statSelection = 0;
        return;
      }
      
      if (this.currentScenario && this.currentScenario.isBoss) {
        this.victory();
        return;
      }
    }
    
    this.currentEnemy = null;
    this.player.tempStats = {};
    this.proceedToNextScenario();
  }

  proceedToNextScenario() {
    const nextScenario = this.scenarioManager.getNextScenario(this);
    
    if (!nextScenario) {
      this.victory();
      return;
    }
    
    this.currentScenario = nextScenario;
    this.state = GAME_STATES.SCENARIO;
    this.selectedOption = 0;
  }

  startGame() {
    this.player = new Player();
    this.scenarioManager.reset();
    this.messageLog = [];
    this.currentScenario = SCENARIOS.entrance;
    this.state = GAME_STATES.SCENARIO;
    this.selectedOption = 0;
  }

  gameOver() {
    this.state = GAME_STATES.GAME_OVER;
    this.gameResult = `You were defeated at level ${this.player.level}`;
  }

  victory() {
    this.state = GAME_STATES.VICTORY;
    const path = this.scenarioManager.currentPath === 'light' ? 'Light' : 'Shadow';
    this.gameResult = `Victory! You conquered the Path of ${path} at level ${this.player.level}!`;
  }

  reset() {
    this.state = GAME_STATES.MENU;
    this.player = new Player();
    this.scenarioManager.reset();
    this.currentEnemy = null;
    this.currentScenario = null;
    this.messageLog = [];
    this.gameResult = null;
  }

  update(deltaTime) {
    // Game logic updates happen through input handling
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Clear screen
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    
    if (this.state === GAME_STATES.MENU) {
      this.renderMenu();
    } else if (this.state === GAME_STATES.SCENARIO) {
      this.renderScenario();
    } else if (this.state === GAME_STATES.COMBAT) {
      this.renderCombat();
    } else if (this.state === GAME_STATES.INVENTORY) {
      this.renderInventory();
    } else if (this.state === GAME_STATES.LEVEL_UP) {
      this.renderLevelUp();
    } else if (this.state === GAME_STATES.GAME_OVER) {
      this.renderGameOver();
    } else if (this.state === GAME_STATES.VICTORY) {
      this.renderVictory();
    }
    
    // Always render player stats at top
    if (this.state !== GAME_STATES.MENU && this.state !== GAME_STATES.GAME_OVER && this.state !== GAME_STATES.VICTORY) {
      this.renderPlayerStats();
    }
  }

  renderMenu() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DUNGEON ADVENTURE', w/2, 150);
    
    ctx.fillStyle = '#f1f1f1';
    ctx.font = '24px Arial';
    ctx.fillText('Press ENTER to Start', w/2, 300);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Arrow Keys to Navigate | ENTER to Select | I for Inventory', w/2, 400);
    ctx.fillText('Choose your path wisely...', w/2, 500);
  }

  renderPlayerStats() {
    const ctx = this.ctx;
    const stats = this.player.getTotalStats();
    
    ctx.fillStyle = '#16213e';
    ctx.fillRect(10, 10, 250, 110);
    ctx.strokeStyle = '#0f3460';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 250, 110);
    
    ctx.fillStyle = '#f1f1f1';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Level ${this.player.level} | XP: ${this.player.xp}/${calculateXPForLevel(this.player.level + 1)}`, 20, 30);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = '#e94560';
    ctx.fillText(`HP: ${this.player.health}/${this.player.maxHealth}`, 20, 50);
    
    ctx.fillStyle = '#f39c12';
    ctx.fillText(`STR: ${stats.strength} DEF: ${stats.defense}`, 20, 70);
    ctx.fillText(`AGI: ${stats.agility} INT: ${stats.intelligence}`, 20, 90);
    
    if (this.player.statPoints > 0) {
      ctx.fillStyle = '#2ecc71';
      ctx.fillText(`Stat Points: ${this.player.statPoints}`, 20, 110);
    }
  }

  renderScenario() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    
    if (!this.currentScenario) return;
    
    ctx.fillStyle = '#f1f1f1';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.currentScenario.title, w/2, 160);
    
    ctx.font = '18px Arial';
    ctx.fillText(this.currentScenario.description, w/2, 200);
    
    if (this.currentScenario.combat) {
      ctx.fillStyle = '#e94560';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('Press ENTER to fight!', w/2, 300);
    } else {
      const choices = this.currentScenario.choices;
      let y = 260;
      
      choices.forEach((choice, i) => {
        if (i === this.selectedOption) {
          ctx.fillStyle = '#e94560';
          ctx.fillRect(w/2 - 250, y - 25, 500, 35);
        }
        
        ctx.fillStyle = i === this.selectedOption ? '#fff' : '#aaa';
        ctx.font = '20px Arial';
        ctx.fillText(choice.text, w/2, y);
        y += 45;
      });
    }
    
    this.renderMessageLog();
  }

  renderCombat() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    
    if (!this.currentEnemy) return;
    
    // Enemy display
    ctx.fillStyle = '#16213e';
    ctx.fillRect(w/2 - 150, 140, 300, 100);
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 3;
    ctx.strokeRect(w/2 - 150, 140, 300, 100);
    
    ctx.fillStyle = '#f1f1f1';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.currentEnemy.name, w/2, 170);
    
    ctx.font = '18px Arial';
    ctx.fillStyle = '#e94560';
    ctx.fillText(`HP: ${this.currentEnemy.health}/${this.currentEnemy.maxHealth}`, w/2, 200);
    
    ctx.fillStyle = '#f39c12';
    ctx.fillText(`Lvl ${this.currentEnemy.level} | STR: ${this.currentEnemy.strength} DEF: ${this.currentEnemy.defense}`, w/2, 225);
    
    // Combat options
    const options = ['Attack', 'Special Attack', 'Use Item', 'Escape'];
    let y = 280;
    
    ctx.font = '20px Arial';
    options.forEach((opt, i) => {
      if (i === this.selectedOption) {
        ctx.fillStyle = '#e94560';
        ctx.fillRect(w/2 - 150, y - 25, 300, 35);
      }
      
      ctx.fillStyle = i === this.selectedOption ? '#fff' : '#aaa';
      ctx.fillText(opt, w/2, y);
      y += 40;
    });
    
    // Combat log
    const log = this.combatSystem.combatLog;
    y = 460;
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    log.slice(-5).forEach(msg => {
      ctx.fillStyle = '#aaa';
      ctx.fillText(msg, 20, y);
      y += 20;
    });
    
    // Turn indicator
    ctx.fillStyle = this.combatSystem.playerTurn ? '#2ecc71' : '#e74c3c';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.combatSystem.playerTurn ? 'YOUR TURN' : 'ENEMY TURN', w/2, 440);
  }

  renderInventory() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    
    ctx.fillStyle = '#f1f1f1';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('INVENTORY', w/2, 160);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press I or ESC to close', w/2, 190);
    
    // Equipped items
    let y = 220;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('EQUIPPED:', 50, y);
    
    y += 25;
    ctx.font = '16px Arial';
    ctx.fillStyle = '#2ecc71';
    Object.entries(this.player.inventory.equipped).forEach(([slot, item]) => {
      const text = item ? `${slot}: ${item.name}` : `${slot}: (empty)`;
      ctx.fillText(text, 50, y);
      y += 22;
    });
    
    // Items
    y += 20;
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('ITEMS:', 50, y);
    
    y += 25;
    const items = this.player.inventory.items;
    
    if (items.length === 0) {
      ctx.fillStyle = '#aaa';
      ctx.font = '16px Arial';
      ctx.fillText('(empty)', 50, y);
    } else {
      items.forEach((item, i) => {
        if (i === this.inventorySelection) {
          ctx.fillStyle = '#e94560';
          ctx.fillRect(45, y - 18, 700, 25);
        }
        
        ctx.fillStyle = i === this.inventorySelection ? '#fff' : '#aaa';
        ctx.font = '16px Arial';
        ctx.fillText(`${item.name} - ${item.description}`, 50, y);
        y += 25;
      });
    }
  }

  renderLevelUp() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL UP!', w/2, 160);
    
    ctx.fillStyle = '#f1f1f1';
    ctx.font = '20px Arial';
    ctx.fillText(`You are now level ${this.player.level}`, w/2, 200);
    
    if (this.player.statPoints > 0) {
      ctx.fillText(`Stat Points Available: ${this.player.statPoints}`, w/2, 240);
      
      const stats = ['strength', 'defense', 'agility', 'intelligence'];
      let y = 280;
      
      stats.forEach((stat, i) => {
        if (i === this.statSelection) {
          ctx.fillStyle = '#e94560';
          ctx.fillRect(w/2 - 150, y - 25, 300, 35);
        }
        
        ctx.fillStyle = i === this.statSelection ? '#fff' : '#aaa';
        ctx.font = '20px Arial';
        ctx.fillText(`${stat.toUpperCase()}: ${this.player.baseStats[stat]}`, w/2, y);
        y += 40;
      });
      
      ctx.fillStyle = '#aaa';
      ctx.font = '16px Arial';
      ctx.fillText('Press ENTER to allocate point', w/2, y + 20);
    } else {
      ctx.fillStyle = '#2ecc71';
      ctx.font = '20px Arial';
      ctx.fillText('All points allocated!', w/2, 300);
      ctx.fillStyle = '#aaa';
      ctx.font = '16px Arial';
      ctx.fillText('Press ENTER to continue', w/2, 340);
    }
  }

  renderGameOver() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', w/2, 250);
    
    ctx.fillStyle = '#f1f1f1';
    ctx.font = '24px Arial';
    ctx.fillText(this.gameResult, w/2, 320);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '18px Arial';
    ctx.fillText('Press ENTER to return to menu', w/2, 400);
  }

  renderVictory() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', w/2, 250);
    
    ctx.fillStyle = '#f1f1f1';
    ctx.font = '24px Arial';
    ctx.fillText(this.gameResult, w/2, 320);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '18px Arial';
    ctx.fillText('Press ENTER to return to menu', w/2, 400);
  }

  renderMessageLog() {
    const ctx = this.ctx;
    
    let y = 520;
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aaa';
    
    this.messageLog.forEach(msg => {
      ctx.fillText(msg, 20, y);
      y += 20;
    });
  }
}

// ============================================================================
// REACT COMPONENT
// ============================================================================

export default function DungeonAdventure() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;

    const game = new Game(canvas);
    gameRef.current = game;

    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
      }
      game.keys[e.key] = true;
      game.handleKeyPress(e.key);
    };

    const handleKeyUp = (e) => {
      game.keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const gameLoop = (timestamp) => {
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      game.update(deltaTime);
      game.render();

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <canvas
        ref={canvasRef}
        className="border-4 border-gray-700 rounded-lg shadow-2xl"
        style={{ imageRendering: 'crisp-edges' }}
      />
      <div className="mt-4 text-gray-400 text-sm text-center max-w-2xl">
        <p className="mb-2">
          <strong className="text-white">Controls:</strong> Arrow Keys (navigate) | Enter (select) | I (inventory)
        </p>
        <p>
          Choose between the Path of Light or Shadow. Each path offers unique enemies, scenarios, and rewards!
        </p>
      </div>
    </div>
  );
}