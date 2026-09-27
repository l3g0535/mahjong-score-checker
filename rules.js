export const SCORING_RULES = [
  // --- BASE POINT ---
  {
    id: 'Dragon Pong',
    name: 'Dragon Pong',
    chineseName: '箭刻 (Jian Ke)',
    fan: 1,
    category: 'Base Point',
    description: 'one Dragon Pong',
    exampleTiles: [
      '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg'
    ]
  },
  {
    id: 'Seat Wind',
    name: 'Seat Wind',
    chineseName: '门风 (Men Feng)',
    fan: 1,
    category: 'Base Point',
    description: 'pong matching your Seat Wind.',
    exampleTiles: [
      '/tiles/04-east-wind.svg', '/tiles/04-east-wind.svg', '/tiles/04-east-wind.svg'
    ]
  },
  {
    id: 'Round Wind',
    name: 'Round Wind',
    chineseName: '圈風 (Quan Feng) or 场风 (Chang Feng)',
    fan: 1,
    category: 'Base Point',
    description: 'pong matching Round Wind.',
    exampleTiles: [
      '/tiles/05-south-wind.svg', '/tiles/05-south-wind.svg', '/tiles/05-south-wind.svg'
    ]
  },
  {
    id: 'All Sequences',
    name: 'All Sequences',
    chineseName: '平胡 (Ping Hu)',
    fan: 1,
    category: 'Base Point',
    description: 'all 4 sets are Chi / Chow.',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/09-characters-2.svg', '/tiles/10-characters-3.svg',
      '/tiles/17-circles-1.svg', '/tiles/18-circles-2.svg', '/tiles/19-circles-3.svg',
      '/tiles/26-bamboos-1.svg', '/tiles/27-bamboos-2.svg', '/tiles/28-bamboos-3.svg'
    ]
  },
  {
    id: 'All Simple',
    name: 'All Simple',
    chineseName: '断幺九 (Duan Yao Jiu)',
    fan: 1,
    category: 'Base Point',
    description: 'only tiles 2-8, no Terminals / Honors.',
    exampleTiles: [
      '/tiles/09-characters-2.svg', '/tiles/10-characters-3.svg', '/tiles/11-characters-4.svg',
      '/tiles/18-circles-2.svg', '/tiles/19-circles-3.svg', '/tiles/20-circles-4.svg',
      '/tiles/27-bamboos-2.svg', '/tiles/28-bamboos-3.svg', '/tiles/29-bamboos-4.svg'
    ]
  },
  {
    id: 'Concealed Hand',
    name: 'Concealed Hand',
    chineseName: '门清 (Men Qing)',
    fan: 2,
    category: 'Base Point',
    description: 'win by closed hand and Zì Mō.',
    exampleTiles: [
      '/tiles/26-bamboos-1.svg', '/tiles/27-bamboos-2.svg', '/tiles/28-bamboos-3.svg',
      '/tiles/29-bamboos-4.svg', '/tiles/30-bamboos-5.svg', '/tiles/31-bamboos-6.svg'
    ]
  },

  // --- INTERMEDIATE POINT ---
  {
    id: 'Mixed Orphans',
    name: 'Mixed Orphans',
    chineseName: '混幺九 (Hun Yao Jiu)',
    fan: 3,
    category: 'Intermediate Point',
    description: 'each set with at least one Terminal 1 or 9 + Honors',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg',
      '/tiles/16-characters-9.svg', '/tiles/16-characters-9.svg', '/tiles/16-characters-9.svg',
      '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg'
    ]
  },
  {
    id: 'All Triplets',
    name: 'All Triplets',
    chineseName: '碰碰胡 (Peng Peng Hu)',
    fan: 2,
    category: 'Intermediate Point',
    description: 'all sets are Pong',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg',
      '/tiles/18-circles-2.svg', '/tiles/18-circles-2.svg', '/tiles/18-circles-2.svg',
      '/tiles/28-bamboos-3.svg', '/tiles/28-bamboos-3.svg', '/tiles/28-bamboos-3.svg'
    ]
  },
  {
    id: 'Half Flush',
    name: 'Half Flush',
    chineseName: '混一色 (Hun Yi Se)',
    fan: 3,
    category: 'Intermediate Point',
    description: 'only 1 suit + Honors',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/09-characters-2.svg', '/tiles/10-characters-3.svg',
      '/tiles/11-characters-4.svg', '/tiles/12-characters-5.svg', '/tiles/13-characters-6.svg',
      '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg'
    ]
  },
  {
    id: 'Pure Straight',
    name: 'Pure Straight',
    chineseName: '清龍七對 / 一氣通貫',
    fan: 3,
    category: 'Intermediate Point',
    description: '3 sets consist of 123-456-789 of the same suit.',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/09-characters-2.svg', '/tiles/10-characters-3.svg',
      '/tiles/11-characters-4.svg', '/tiles/12-characters-5.svg', '/tiles/13-characters-6.svg',
      '/tiles/14-characters-7.svg', '/tiles/15-characters-8.svg', '/tiles/16-characters-9.svg'
    ]
  },
  {
    id: 'Seven Pairs',
    name: 'Seven Pairs',
    chineseName: '七對子 (Qi Dui Zi)',
    fan: 4,
    category: 'Intermediate Point',
    description: 'seven different pairs',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg',
      '/tiles/10-characters-3.svg', '/tiles/10-characters-3.svg',
      '/tiles/17-circles-1.svg', '/tiles/17-circles-1.svg',
      '/tiles/26-bamboos-1.svg', '/tiles/26-bamboos-1.svg'
    ]
  },
  {
    id: 'Pure Orphans',
    name: 'Pure Orphans',
    chineseName: '清幺九 (Qing Yao Jiu)',
    fan: 5,
    category: 'Intermediate Point',
    description: 'each set with at least one Terminal 1 or 9, no Honors',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg',
      '/tiles/16-characters-9.svg', '/tiles/16-characters-9.svg', '/tiles/16-characters-9.svg',
      '/tiles/17-circles-1.svg', '/tiles/17-circles-1.svg', '/tiles/17-circles-1.svg'
    ]
  },
  {
    id: 'Small Dragons',
    name: 'Small Dragons',
    chineseName: '小三元 (Xiao San Yuan)',
    fan: 5,
    category: 'Intermediate Point',
    description: 'two Dragon triplets and a pair of the third Dragon',
    exampleTiles: [
      '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg',
      '/tiles/02-green-dragon.svg', '/tiles/02-green-dragon.svg', '/tiles/02-green-dragon.svg',
      '/tiles/01-white-dragon.svg', '/tiles/01-white-dragon.svg'
    ]
  },
  {
    id: 'Full Flush',
    name: 'Full Flush',
    chineseName: '清一色 (Qing Yi Se)',
    fan: 7,
    category: 'Intermediate Point',
    description: 'one suit only, no Honors',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/09-characters-2.svg', '/tiles/10-characters-3.svg',
      '/tiles/11-characters-4.svg', '/tiles/12-characters-5.svg', '/tiles/13-characters-6.svg',
      '/tiles/14-characters-7.svg', '/tiles/15-characters-8.svg', '/tiles/16-characters-9.svg'
    ]
  },
  {
    id: 'Small Wind',
    name: 'Small Wind',
    chineseName: '小四喜 (Xiao Si Xi)',
    fan: 10,
    category: 'Intermediate Point',
    description: 'three Wind triplets and a pair of the fourth Wind (Not Stackable)',
    exampleTiles: [
      '/tiles/04-east-wind.svg', '/tiles/04-east-wind.svg', '/tiles/04-east-wind.svg',
      '/tiles/05-south-wind.svg', '/tiles/05-south-wind.svg', '/tiles/05-south-wind.svg',
      '/tiles/06-west-wind.svg', '/tiles/06-west-wind.svg', '/tiles/06-west-wind.svg',
      '/tiles/07-north-wind.svg', '/tiles/07-north-wind.svg'
    ]
  },

  // --- SPECIAL HANDS ---
  {
    id: 'Thirteen Orphans',
    name: 'Thirteen Orphans',
    chineseName: '十三幺 (Shi San Yao)',
    fan: 13,
    category: 'Special Hands',
    description: '1 and 9 of each suit, one of each Wind and Dragon + 1 duplicate pair',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/16-characters-9.svg',
      '/tiles/17-circles-1.svg', '/tiles/25-circles-9.svg',
      '/tiles/26-bamboos-1.svg', '/tiles/34-bamboos-9.svg',
      '/tiles/04-east-wind.svg', '/tiles/05-south-wind.svg', '/tiles/06-west-wind.svg', '/tiles/07-north-wind.svg',
      '/tiles/03-red-dragon.svg', '/tiles/02-green-dragon.svg', '/tiles/01-white-dragon.svg', '/tiles/01-white-dragon.svg'
    ]
  },
  {
    id: 'Four Kongs',
    name: 'Four Kongs',
    chineseName: '十八羅漢 (Shi Ba Luo Han)',
    fan: 13,
    category: 'Special Hands',
    description: 'four sets of Kong',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg',
      '/tiles/17-circles-1.svg', '/tiles/17-circles-1.svg', '/tiles/17-circles-1.svg', '/tiles/17-circles-1.svg'
    ]
  },
  {
    id: 'Big Four Winds',
    name: 'Big Four Winds',
    chineseName: '大四喜 (Da Si Xi)',
    fan: 13,
    category: 'Special Hands',
    description: 'four Wind triplets + 1 pair of any tile.',
    exampleTiles: [
      '/tiles/04-east-wind.svg', '/tiles/04-east-wind.svg', '/tiles/04-east-wind.svg',
      '/tiles/05-south-wind.svg', '/tiles/05-south-wind.svg', '/tiles/05-south-wind.svg',
      '/tiles/06-west-wind.svg', '/tiles/06-west-wind.svg', '/tiles/06-west-wind.svg',
      '/tiles/07-north-wind.svg', '/tiles/07-north-wind.svg', '/tiles/07-north-wind.svg'
    ]
  },
  {
    id: 'Big Three Dragons',
    name: 'Big Three Dragons',
    chineseName: '大三元 (Da San Yuan)',
    fan: 13,
    category: 'Special Hands',
    description: 'three Dragon triplets',
    exampleTiles: [
      '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg',
      '/tiles/02-green-dragon.svg', '/tiles/02-green-dragon.svg', '/tiles/02-green-dragon.svg',
      '/tiles/01-white-dragon.svg', '/tiles/01-white-dragon.svg', '/tiles/01-white-dragon.svg'
    ]
  },
  {
    id: 'All Honors',
    name: 'All Honors',
    chineseName: '字一色 (Zi Yi Se)',
    fan: 13,
    category: 'Special Hands',
    description: 'only Honor tiles',
    exampleTiles: [
      '/tiles/04-east-wind.svg', '/tiles/04-east-wind.svg', '/tiles/04-east-wind.svg',
      '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg',
      '/tiles/02-green-dragon.svg', '/tiles/02-green-dragon.svg', '/tiles/02-green-dragon.svg'
    ]
  },
  {
    id: 'All Terminals',
    name: 'All Terminals',
    chineseName: '清幺九 (Qing Yao Jiu)',
    fan: 13,
    category: 'Special Hands',
    description: 'triplets of only 1 and 9 tiles',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg',
      '/tiles/16-characters-9.svg', '/tiles/16-characters-9.svg', '/tiles/16-characters-9.svg',
      '/tiles/17-circles-1.svg', '/tiles/17-circles-1.svg', '/tiles/17-circles-1.svg'
    ]
  },
  {
    id: 'Nine Gates',
    name: 'Nine Gates',
    chineseName: '九蓮寶燈 (Jiu Lian Bao Deng)',
    fan: 13,
    category: 'Special Hands',
    description: '111 2345678 999 of a single suit + 14th tile of the same suit (fully concealed)',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg',
      '/tiles/09-characters-2.svg', '/tiles/10-characters-3.svg', '/tiles/11-characters-4.svg',
      '/tiles/12-characters-5.svg', '/tiles/13-characters-6.svg', '/tiles/14-characters-7.svg',
      '/tiles/15-characters-8.svg', '/tiles/16-characters-9.svg', '/tiles/16-characters-9.svg', '/tiles/16-characters-9.svg'
    ]
  },
  {
    id: 'All Concealed Pong',
    name: 'All Concealed Pong',
    chineseName: '四暗刻 (Si An Ke)',
    fan: 13,
    category: 'Special Hands',
    description: 'four closed-hand triplets, must win by Zì Mō',
    exampleTiles: [
      '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg', '/tiles/08-characters-1.svg',
      '/tiles/17-circles-1.svg', '/tiles/17-circles-1.svg', '/tiles/17-circles-1.svg',
      '/tiles/26-bamboos-1.svg', '/tiles/26-bamboos-1.svg', '/tiles/26-bamboos-1.svg'
    ]
  },

  // --- FLOWERS & BONUS ---
  {
    id: 'Flower matching seat number',
    name: 'Flower matching seat number',
    chineseName: '正花 (Zheng Hua)',
    fan: 1,
    category: 'Flowers & Bonus',
    description: 'Drawing the flower tile that matches your assigned seat wind number (East=1, South=2, West=3, North=4).',
    exampleTiles: [
      '/tiles/35-spring.svg', '/tiles/39-plum.svg'
    ]
  },
  {
    id: 'All Flowers & Seasons',
    name: 'All Flowers & Seasons (4 Flowers + 4 Seasons)',
    chineseName: '花胡 (Hua Hu)',
    fan: 5,
    category: 'Flowers & Bonus',
    description: 'win immediately on drawing the last flower tile. Counts as Zì Mō',
    exampleTiles: [
      '/tiles/35-spring.svg', '/tiles/36-summer.svg', '/tiles/37-autumn.svg', '/tiles/38-winter.svg',
      '/tiles/39-plum.svg', '/tiles/40-orchid.svg', '/tiles/41-chrysanthemum.svg', '/tiles/42-bamboo.svg'
    ]
  },

  // --- WIN CONDITIONS ---
  {
    id: 'Normal Kong',
    name: 'Normal Kong',
    chineseName: '槓 (Gang)',
    fan: 0,
    category: 'Win Conditions',
    description: 'No points for exposed/concealed Kong',
    exampleTiles: [
      '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg', '/tiles/03-red-dragon.svg'
    ]
  },
  {
    id: 'Hu',
    name: 'Hú',
    chineseName: '胡 (Hu)',
    fan: 0,
    category: 'Win Conditions',
    description: 'Win by discard'
  },
  {
    id: 'Win by Robbing Kong',
    name: 'Win by Robbing Kong',
    chineseName: '搶槓 (Qiang Gang)',
    fan: 1,
    category: 'Win Conditions',
    description: 'winning by robbing someone else’s Kong'
  },
  {
    id: 'Win by Kong Replacement',
    name: 'Win by Kong Replacement',
    chineseName: '槓上開花 (Gang Shang Kai Hua)',
    fan: 1,
    category: 'Win Conditions',
    description: 'winning tile is drawn as a replacement for Kong or Flower'
  },
  {
    id: 'Zi Mo',
    name: 'Zì Mō',
    chineseName: '自摸 (Zi Mo)',
    fan: 1,
    category: 'Win Conditions',
    description: 'win by self-draw.'
  },
  {
    id: 'Tian hu',
    name: 'Tiān Hú (Heavenly Hand)',
    chineseName: '天胡 (Tian Hu)',
    fan: 10,
    category: 'Win Conditions',
    description: 'the dealer wins immediately on the first deal'
  },
  {
    id: 'Di hu',
    name: 'Dì Hú (Earthly Hand)',
    chineseName: '地胡 (Di Hu)',
    fan: 10,
    category: 'Win Conditions',
    description: 'A non-dealer player wins instantly on the dealer’s very first discard'
  }
];