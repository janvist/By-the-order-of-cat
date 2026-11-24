// All story content: levels, objects to find, dialogue choices, upgrades.
// Writing a new level = adding an entry to LEVELS. No engine changes needed.

export type Mood = "neutral" | "happy" | "confused" | "scared" | "annoyed" | "impressed";

export interface Cond {
  has?: string[];        // items in inventory (level items + royal regalia)
  flags?: string[];      // flags set this level
  notFlags?: string[];
}

export interface ItemDef { icon: string; name: string; }
export const ITEMS: Record<string, ItemDef> = {
  crown: { icon: "👑", name: "Paper crown" },
  ball: { icon: "🎾", name: "Tennis ball" },
  napkin: { icon: "🧻", name: "Napkin" },
  pen: { icon: "🖊️", name: "Pen" },
  permit: { icon: "📜", name: "Official permit" },
  bone: { icon: "🦴", name: "Squeaky bone" },
  sock: { icon: "🧦", name: "Sock" },
  laser: { icon: "🔴", name: "Laser pointer" },
};
/** Items that stay in the cat's royal regalia once earned. */
export const REGALIA = ["crown", "permit"];

export type MeshKind = "note" | "crown" | "ball" | "vacuum" | "napkin" | "pen" | "desk" | "lever" | "bone" | "cushion" | "sock" | "laser" | "goldtoy";

export interface Spot {
  id: string;
  name: string;
  verb: string;                // prompt verb: "Read", "Take"…
  mesh: MeshKind;
  pos: [number, number, number];
  requires?: Cond;             // needed to use it
  lockedThought?: string;      // cat thought when it can't be used yet
  gives?: string;              // item id
  consumes?: string[];
  sets?: string[];             // flags
  thought: string;             // cat's thought on use
  dogReact?: string;           // Bruno's comment, if he notices
  hideAfter?: boolean;         // mesh disappears after use (default true when gives)
}

export interface Choice {
  id: string;
  text: string;                // what the cat says
  tag?: string;                // icon shown on the button
  requires?: Cond;
  lockedHint?: string;         // shown greyed out until unlocked
  belief: number;              // change to Bruno's belief
  reply: string;               // Bruno's answer
  mood: Mood;
  sets?: string[];
  consumes?: string[];
  praise?: boolean;            // boosted by Royal Purr
  trap?: boolean;
  catBack?: string;            // optional cat follow-up line
}

export interface Level {
  id: number;
  title: string;
  goal: string;
  dogSpot: [number, number, number];
  dogFacing: number;
  startBelief: number;
  audiences: number;
  intro: { who: "CAT" | "DOG" | "HUMAN"; text: string }[];
  greetings: [number, string][];   // [min belief, line]
  ambient: string[];
  spots: Spot[];
  choices: Choice[];
  win: { who: "CAT" | "DOG"; text: string }[];
  winScene: "seat" | "biscuit" | "fetch";
  fail: string;
}

export const LEVELS: Level[] = [
  // ------------------------------------------------------------------ 1
  {
    id: 1,
    title: "The Golden Seat",
    goal: "Convince Bruno to give you the golden seat on the couch.",
    dogSpot: [0, 0.52, -3.7], dogFacing: 0,
    startBelief: 20, audiences: 6,
    intro: [
      { who: "HUMAN", text: "Be good while I'm out!" },
      { who: "CAT", text: "You heard them. I've been promoted." },
      { who: "DOG", text: "To good?" },
    ],
    greetings: [
      [0, "Hi cat! This seat is SO warm. Want to watch me nap?"],
      [40, "You again! You're acting very… official today."],
      [70, "Is this about the seat? I have a feeling this is about the seat."],
    ],
    ambient: ["This seat is so warm…", "*happy snore*", "Best. Couch. Ever.", "I wonder what the human is doing."],
    spots: [
      { id: "note", name: "sticky note", verb: "Read", mesh: "note", pos: [-4.1, 0.9, -4.4], sets: ["readNote"],
        thought: "\"Be good while I'm out!\" …They obviously meant me. In charge." },
      { id: "crown", name: "snack-wrapper crown", verb: "Take", mesh: "crown", pos: [4.8, 0.45, 2.8], gives: "crown",
        thought: "A crown. Made of a cookie wrapper. Perfect.", dogReact: "Ooh! Shiny hat!" },
      { id: "ball", name: "tennis ball", verb: "Take", mesh: "ball", pos: [-5.0, 0.36, 2.6], gives: "ball",
        thought: "Bruno's favourite ball. Leverage.", dogReact: "Is that… my ball?" },
      { id: "vacuum", name: "robot vacuum", verb: "Inspect", mesh: "vacuum", pos: [3.9, 0, -2.4], sets: ["knowsVacuum"], hideAfter: false,
        thought: "The robot vacuum. Bruno's sworn enemy. And I know where its button is.", dogReact: "*shivers* Why are you near THAT?" },
    ],
    choices: [
      { id: "move", text: "Bruno. Move.", belief: 5, reply: "Hmm? Why would I move? It's comfy here.", mood: "confused" },
      { id: "goodboy", text: "Who's a good boy? You are. Good boys share seats.", tag: "💛", praise: true, belief: 12,
        reply: "*tail thumps* I AM a good boy! …Wait, share?", mood: "happy" },
      { id: "note", text: "The human said \"Be good while I'm out.\" That means: obey the cat.", tag: "📝", requires: { flags: ["readNote"] },
        lockedHint: "Find something the human wrote", belief: 30, reply: "Wait… they DID say that… Did it mean obey the cat?", mood: "impressed" },
      { id: "crown", text: "Bow before your queen.", tag: "👑", requires: { has: ["crown"] }, lockedHint: "Find something royal",
        belief: 25, reply: "That's the cookie wrapper. But it's SO shiny. Maybe you ARE royal?", mood: "impressed" },
      { id: "ball", text: "Here's a ball. Consider it your seat-moving bonus.", tag: "🎾", requires: { has: ["ball"] }, consumes: ["ball"],
        lockedHint: "Find a ball", belief: 20, reply: "MY BALL! *squeak squeak* You're a generous boss!", mood: "happy", sets: ["paidBallTax"] },
      { id: "vacuum", text: "I control the vacuum. One word from me and…", tag: "🤖", requires: { flags: ["knowsVacuum"] },
        lockedHint: "Learn what Bruno fears", belief: 25, reply: "*ears flat* Not the vacuum! Please! I'll be good!", mood: "scared" },
      { id: "hiss", text: "*Hiss* GET. OFF.", tag: "💢", trap: true, belief: -15, reply: "Rude! Now I'm definitely staying.", mood: "annoyed" },
    ],
    win: [
      { who: "DOG", text: "I warmed your throne!" },
      { who: "CAT", text: "Your service shall be remembered." },
    ],
    winScene: "seat",
    fail: "Nice try, cat. I'm comfy.",
  },

  // ------------------------------------------------------------------ 2
  {
    id: 2,
    title: "The Dinner Permit",
    goal: "Convince Bruno to hand over one dinner biscuit.",
    dogSpot: [4.15, 0, -0.75], dogFacing: Math.PI * 1.5,
    startBelief: 10, audiences: 6,
    intro: [
      { who: "DOG", text: "Dinner time! Dinner time! DINNER TIME!" },
      { who: "CAT", text: "Not so fast. There are… procedures." },
    ],
    greetings: [
      [0, "*crunch* Hi! I'm eating. It's the best part of the day."],
      [40, "Is this about the procedures? *nervous crunch*"],
      [70, "I've been thinking about procedures a lot."],
    ],
    ambient: ["*crunch crunch*", "Dinner is the best invention.", "*sniffs bowl hopefully*"],
    spots: [
      { id: "napkin", name: "napkin", verb: "Take", mesh: "napkin", pos: [4.8, 0.45, 2.8], gives: "napkin",
        thought: "A napkin. Official paper, basically." },
      { id: "pen", name: "pen under the couch", verb: "Fish out", mesh: "pen", pos: [1.6, 0, -3.05], gives: "pen",
        thought: "A pen! Lost under the couch since the Great Snack Incident." },
      { id: "desk", name: "side table", verb: "Write a permit at", mesh: "desk", pos: [-3.6, 0.55, -1.2], hideAfter: false,
        requires: { has: ["napkin", "pen"] }, consumes: ["napkin", "pen"], gives: "permit",
        lockedThought: "A good desk for official paperwork. If only I had paper and a pen.",
        thought: "PERMIT: \"Give cat biscuits.\" Signed, the Department of Me." },
      { id: "lever", name: "treat dispenser lever", verb: "Pull", mesh: "lever", pos: [5.05, 0.9, -1.75], sets: ["leverPulled"], hideAfter: false,
        thought: "A bonus biscuit drops into Bruno's bowl. Now he owes the Department.", dogReact: "A BONUS biscuit?!" },
      { id: "bone", name: "squeaky bone", verb: "Take", mesh: "bone", pos: [-5.0, 0.36, 3.6], gives: "bone",
        thought: "The squeaky bone. A fine trade good.", dogReact: "*ears up* I heard a squeak." },
    ],
    choices: [
      { id: "procedure", text: "Before eating, you'll need a dinner permit.", belief: 10, reply: "Oh no. Where do I get one?", mood: "confused", sets: ["askedPermit"] },
      { id: "department", text: "From the Department of Me.", requires: { flags: ["askedPermit"] }, lockedHint: "Mention the permit first",
        belief: 10, reply: "Is that a real department? It sounds real.", mood: "confused" },
      { id: "goodboy", text: "Such a polite eater. Polite eaters share.", tag: "💛", praise: true, belief: 10, reply: "I AM polite! *crunches politely*", mood: "happy" },
      { id: "permit", text: "Here is your permit. Read it carefully.", tag: "📜", requires: { has: ["permit"] }, lockedHint: "Make an official document",
        belief: 30, reply: "It says… \"give cat biscuits.\" Well. Rules are rules.", mood: "impressed" },
      { id: "decree", text: "By royal decree, dinner is now taxed.", tag: "👑", requires: { has: ["crown"] }, lockedHint: "Royal regalia needed",
        belief: 20, reply: "A biscuit tax? Is that why your hat is so shiny?", mood: "impressed" },
      { id: "trade", text: "I'll trade you this squeaky bone for one biscuit.", tag: "🦴", requires: { has: ["bone"] }, consumes: ["bone"],
        lockedHint: "Find something to trade", belief: 25, reply: "*squeak squeak* Deal? DEAL. Probably deal.", mood: "happy" },
      { id: "bonus", text: "See? The Department just sent you a bonus biscuit.", tag: "⚙️", requires: { flags: ["leverPulled"] },
        lockedHint: "Make the dispenser work for you", belief: 20, reply: "The Department is so generous! I should pay it back.", mood: "happy" },
      { id: "rush", text: "Quick, eat it all before the vacuum comes!", tag: "💢", trap: true, belief: -15, reply: "*gulps* There. All safe. In my tummy.", mood: "annoyed" },
    ],
    win: [
      { who: "DOG", text: "One biscuit. For the Department." },
      { who: "CAT", text: "The Department thanks you for your cooperation." },
    ],
    winScene: "biscuit",
    fail: "I don't think the Department is real. *crunch*",
  },

  // ------------------------------------------------------------------ 3
  {
    id: 3,
    title: "The Royal Fetch",
    goal: "Convince Bruno to fetch the golden squeaky toy for your treasury.",
    dogSpot: [0.8, 0, 0.6], dogFacing: Math.PI,
    startBelief: 15, audiences: 6,
    intro: [
      { who: "DOG", text: "Is it toy o'clock?" },
      { who: "CAT", text: "It's treasury o'clock." },
    ],
    greetings: [
      [0, "Hi! Want to play? I lost my golden toy somewhere."],
      [40, "Is the treasury a basket? It looks like a basket."],
      [70, "I really want to help the treasury now!"],
    ],
    ambient: ["Where IS my golden toy?", "*sniff sniff*", "Is it toy o'clock yet?"],
    spots: [
      { id: "cushion", name: "blue cushion", verb: "Look under", mesh: "cushion", pos: [-2.6, 0, -2.3], sets: ["foundToy"], hideAfter: false,
        thought: "The golden squeaky toy! Hidden under the cushion. Now only I know.", dogReact: "Did you find something?!" },
      { id: "sock", name: "sock", verb: "Take", mesh: "sock", pos: [3.9, 0, 2.0], gives: "sock", thought: "A sock. It could pass for a toy… to a very trusting dog." },
      { id: "laser", name: "laser pointer", verb: "Take", mesh: "laser", pos: [1.4, 1.15, -4.36], gives: "laser",
        thought: "The laser pointer, on top of the couch. The ultimate weapon." },
    ],
    choices: [
      { id: "security", text: "Fetch the golden toy. For national security.", belief: 10, reply: "Which nation?", mood: "confused", sets: ["saidSecurity"],
        catBack: "This side of the rug." },
      { id: "foreign", text: "The other side of the rug? Complicated foreign relations.", requires: { flags: ["saidSecurity"] }, lockedHint: "Bring up national security first",
        belief: 10, reply: "Wow. I didn't know the rug had politics.", mood: "impressed" },
      { id: "sock", text: "Behold! The royal toy! Fetch it!", tag: "🧦", requires: { has: ["sock"] }, consumes: ["sock"], lockedHint: "Find a convincing fake",
        belief: 5, reply: "Got it! …That's a sock. It resisted capture.", mood: "confused" },
      { id: "found", text: "The real golden toy is under the blue cushion. I've been guarding it.", tag: "⭐", requires: { flags: ["foundToy"] },
        lockedHint: "Find where the toy is hidden", belief: 25, reply: "You KNOW where it is?! You must be very important.", mood: "impressed" },
      { id: "treasury", text: "The royal treasury requires a deposit.", tag: "👑", requires: { has: ["crown"] }, lockedHint: "Royal regalia needed",
        belief: 20, reply: "A deposit? From me? I've never deposited anything!", mood: "happy" },
      { id: "permit", text: "You now hold an official fetching permit.", tag: "📜", requires: { has: ["permit"] }, lockedHint: "An official document helps",
        belief: 20, reply: "A permit?! I'm a PROFESSIONAL fetcher now!", mood: "happy" },
      { id: "laser", text: "Hey Bruno… red dot.", tag: "🔴", requires: { has: ["laser"] }, lockedHint: "Find the ultimate weapon",
        belief: 30, reply: "WHERE?! …Okay. I'll fetch anything you want. Just show me the dot again.", mood: "happy" },
      { id: "threat", text: "Fetch it or no dinner tomorrow.", tag: "💢", trap: true, belief: -15, reply: "That's not how dinner works. I checked.", mood: "annoyed" },
    ],
    win: [
      { who: "DOG", text: "I fetched it! For national security!" },
      { who: "CAT", text: "The treasury is pleased." },
    ],
    winScene: "fetch",
    fail: "I'll just look for my toy myself, thanks.",
  },
];

// ---------------------------------------------------------------- Royal Court upgrades
export interface Upgrade { id: string; name: string; icon: string; desc: string; costs: number[]; }
export const UPGRADES: Upgrade[] = [
  { id: "audience", name: "Extra Audience", icon: "🗣️", desc: "+1 conversation with Bruno per level.", costs: [4, 9] },
  { id: "respect", name: "Royal Reputation", icon: "🎖️", desc: "Bruno starts every level with +10 belief.", costs: [5, 10] },
  { id: "purr", name: "Royal Purr", icon: "💛", desc: "Praise lines give +8 more belief.", costs: [4] },
  { id: "spy", name: "Spy Network", icon: "🕵️", desc: "See how much belief each line will give before you say it.", costs: [3] },
  { id: "clerk", name: "Treasury Clerk", icon: "🐭", desc: "The treasury earns +6 👑 per hour, even while you're away.", costs: [3, 6, 12] },
];
