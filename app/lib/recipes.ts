// Seeded recipe library — the flagship OUTPUT surface (DESIGN.md §7). Volume
// comes from this curated set (and, later, user saves / a recipe API) so the
// feature never depends on the user authoring recipes. Ingredients are written
// as simple canonical names; matching against the pantry is fuzzy and lenient
// (see recipes.helper.ts) because we match "what you typically keep", not exact
// counts — exact-quantity tracking is precisely what Locavault refuses to require.

export type RecipeTag =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "soup"
  | "salad"
  | "side"
  | "baking"
  | "quick"
  | "vegetarian";

export type Recipe = {
  id: string;
  name: string;
  blurb: string;
  /** Canonical ingredient names (lowercase, singular where natural). */
  ingredients: string[];
  tags: RecipeTag[];
  minutes: number;
  serves: number;
};

export const RECIPES: Recipe[] = [
  // ── Breakfast ──
  {
    id: "scrambled-eggs",
    name: "Scrambled Eggs",
    blurb: "Soft, buttery eggs in ten minutes.",
    ingredients: ["egg", "butter", "milk"],
    tags: ["breakfast", "quick", "vegetarian"],
    minutes: 10,
    serves: 1,
  },
  {
    id: "omelette",
    name: "Cheese Omelette",
    blurb: "Folded eggs with melted cheese and onion.",
    ingredients: ["egg", "cheese", "onion", "butter"],
    tags: ["breakfast", "quick", "vegetarian"],
    minutes: 15,
    serves: 1,
  },
  {
    id: "pancakes",
    name: "Pancakes",
    blurb: "Fluffy stack from store-cupboard basics.",
    ingredients: ["flour", "egg", "milk", "sugar", "butter"],
    tags: ["breakfast", "vegetarian"],
    minutes: 20,
    serves: 2,
  },
  {
    id: "french-toast",
    name: "French Toast",
    blurb: "A sweet way to rescue day-old bread.",
    ingredients: ["bread", "egg", "milk", "sugar"],
    tags: ["breakfast", "quick", "vegetarian"],
    minutes: 15,
    serves: 2,
  },
  {
    id: "avocado-toast",
    name: "Avocado Toast",
    blurb: "Smashed avocado on toast, egg optional.",
    ingredients: ["bread", "avocado", "egg"],
    tags: ["breakfast", "quick", "vegetarian"],
    minutes: 10,
    serves: 1,
  },
  {
    id: "oatmeal",
    name: "Porridge",
    blurb: "Warm oats with banana and honey.",
    ingredients: ["oat", "milk", "banana", "honey"],
    tags: ["breakfast", "quick", "vegetarian"],
    minutes: 10,
    serves: 1,
  },
  {
    id: "smoothie",
    name: "Banana Smoothie",
    blurb: "Blend, pour, done.",
    ingredients: ["banana", "milk", "yogurt", "honey"],
    tags: ["breakfast", "quick", "vegetarian"],
    minutes: 5,
    serves: 1,
  },
  {
    id: "yogurt-parfait",
    name: "Yogurt Parfait",
    blurb: "Layered yogurt, granola and fruit.",
    ingredients: ["yogurt", "granola", "banana", "honey"],
    tags: ["breakfast", "quick", "vegetarian"],
    minutes: 5,
    serves: 1,
  },
  {
    id: "shakshuka",
    name: "Shakshuka",
    blurb: "Eggs poached in spiced tomato and pepper.",
    ingredients: ["egg", "tomato", "onion", "pepper", "garlic"],
    tags: ["breakfast", "dinner", "vegetarian"],
    minutes: 30,
    serves: 2,
  },

  // ── Quick / lunch ──
  {
    id: "grilled-cheese",
    name: "Grilled Cheese",
    blurb: "Golden, oozing, five ingredients or fewer.",
    ingredients: ["bread", "cheese", "butter"],
    tags: ["lunch", "quick", "vegetarian"],
    minutes: 10,
    serves: 1,
  },
  {
    id: "ham-cheese-toastie",
    name: "Ham & Cheese Toastie",
    blurb: "The lunchbox classic, toasted.",
    ingredients: ["bread", "ham", "cheese", "butter"],
    tags: ["lunch", "quick"],
    minutes: 10,
    serves: 1,
  },
  {
    id: "tuna-sandwich",
    name: "Tuna Sandwich",
    blurb: "Tuna, mayo and a little onion.",
    ingredients: ["bread", "tuna", "mayonnaise", "onion"],
    tags: ["lunch", "quick"],
    minutes: 10,
    serves: 1,
  },
  {
    id: "quesadilla",
    name: "Quesadilla",
    blurb: "Crispy tortilla folded over melted cheese.",
    ingredients: ["tortilla", "cheese", "onion", "pepper"],
    tags: ["lunch", "quick", "vegetarian"],
    minutes: 15,
    serves: 1,
  },
  {
    id: "pizza-toast",
    name: "Pizza Toast",
    blurb: "Tomato and cheese on toast, grilled.",
    ingredients: ["bread", "tomato", "cheese"],
    tags: ["lunch", "quick", "vegetarian"],
    minutes: 15,
    serves: 2,
  },

  // ── Pasta / rice dinners ──
  {
    id: "tomato-pasta",
    name: "Tomato Pasta",
    blurb: "A weeknight red sauce over pasta.",
    ingredients: ["pasta", "tomato", "garlic", "onion", "olive oil"],
    tags: ["dinner", "vegetarian"],
    minutes: 25,
    serves: 2,
  },
  {
    id: "bolognese",
    name: "Spaghetti Bolognese",
    blurb: "Slow-simmered beef and tomato ragù.",
    ingredients: ["pasta", "beef", "tomato", "onion", "garlic"],
    tags: ["dinner"],
    minutes: 40,
    serves: 4,
  },
  {
    id: "carbonara",
    name: "Carbonara",
    blurb: "Egg, cheese and bacon — no cream needed.",
    ingredients: ["pasta", "egg", "cheese", "bacon"],
    tags: ["dinner"],
    minutes: 25,
    serves: 2,
  },
  {
    id: "mac-and-cheese",
    name: "Mac & Cheese",
    blurb: "Creamy baked pasta the whole table likes.",
    ingredients: ["pasta", "cheese", "milk", "butter", "flour"],
    tags: ["dinner", "vegetarian"],
    minutes: 30,
    serves: 4,
  },
  {
    id: "fried-rice",
    name: "Egg Fried Rice",
    blurb: "Leftover rice, egg and whatever veg you have.",
    ingredients: ["rice", "egg", "onion", "carrot", "soy sauce"],
    tags: ["dinner", "quick"],
    minutes: 20,
    serves: 2,
  },
  {
    id: "chicken-stir-fry",
    name: "Chicken Stir Fry",
    blurb: "Fast wok dinner over rice.",
    ingredients: ["chicken", "rice", "onion", "garlic", "soy sauce", "pepper"],
    tags: ["dinner"],
    minutes: 25,
    serves: 2,
  },
  {
    id: "veg-stir-fry",
    name: "Vegetable Stir Fry",
    blurb: "Crunchy greens in a garlicky glaze.",
    ingredients: ["rice", "broccoli", "carrot", "pepper", "garlic", "soy sauce"],
    tags: ["dinner", "vegetarian"],
    minutes: 25,
    serves: 2,
  },
  {
    id: "egg-noodles",
    name: "Egg Fried Noodles",
    blurb: "Noodles tossed with egg and veg.",
    ingredients: ["noodle", "egg", "onion", "soy sauce", "carrot"],
    tags: ["dinner", "quick"],
    minutes: 20,
    serves: 2,
  },
  {
    id: "risotto",
    name: "Parmesan Risotto",
    blurb: "Creamy, slow-stirred rice.",
    ingredients: ["rice", "onion", "garlic", "cheese", "butter"],
    tags: ["dinner", "vegetarian"],
    minutes: 40,
    serves: 3,
  },
  {
    id: "lentil-curry",
    name: "Lentil Curry",
    blurb: "Hearty, cheap and freezer-friendly.",
    ingredients: ["lentil", "onion", "garlic", "tomato", "rice"],
    tags: ["dinner", "vegetarian"],
    minutes: 40,
    serves: 4,
  },
  {
    id: "bean-chili",
    name: "Bean Chili",
    blurb: "Smoky beans and tomato, low effort.",
    ingredients: ["bean", "tomato", "onion", "garlic", "pepper"],
    tags: ["dinner", "vegetarian"],
    minutes: 45,
    serves: 4,
  },
  {
    id: "beef-tacos",
    name: "Beef Tacos",
    blurb: "Spiced beef with all the toppings.",
    ingredients: ["beef", "tortilla", "cheese", "tomato", "onion"],
    tags: ["dinner"],
    minutes: 30,
    serves: 3,
  },
  {
    id: "roast-chicken",
    name: "Roast Chicken",
    blurb: "Sunday roast with potatoes.",
    ingredients: ["chicken", "potato", "onion", "garlic", "butter"],
    tags: ["dinner"],
    minutes: 90,
    serves: 4,
  },

  // ── Soups ──
  {
    id: "tomato-soup",
    name: "Tomato Soup",
    blurb: "Smooth and comforting, pairs with toast.",
    ingredients: ["tomato", "onion", "garlic", "cream"],
    tags: ["soup", "vegetarian"],
    minutes: 30,
    serves: 3,
  },
  {
    id: "veg-soup",
    name: "Vegetable Soup",
    blurb: "Clear out the crisper drawer.",
    ingredients: ["onion", "carrot", "potato", "celery", "tomato"],
    tags: ["soup", "vegetarian"],
    minutes: 40,
    serves: 4,
  },
  {
    id: "chicken-soup",
    name: "Chicken Noodle Soup",
    blurb: "The one you make when someone's poorly.",
    ingredients: ["chicken", "carrot", "onion", "celery", "noodle"],
    tags: ["soup"],
    minutes: 45,
    serves: 4,
  },

  // ── Salads & sides ──
  {
    id: "garden-salad",
    name: "Garden Salad",
    blurb: "Crisp leaves with a simple dressing.",
    ingredients: ["lettuce", "tomato", "cucumber", "onion", "olive oil"],
    tags: ["salad", "quick", "vegetarian"],
    minutes: 10,
    serves: 2,
  },
  {
    id: "greek-salad",
    name: "Greek Salad",
    blurb: "Tomato, cucumber, feta and olives.",
    ingredients: ["tomato", "cucumber", "onion", "cheese", "olive"],
    tags: ["salad", "vegetarian"],
    minutes: 15,
    serves: 2,
  },
  {
    id: "caesar-salad",
    name: "Chicken Caesar Salad",
    blurb: "Leaves, chicken, croutons and parmesan.",
    ingredients: ["lettuce", "chicken", "cheese", "bread"],
    tags: ["salad"],
    minutes: 20,
    serves: 2,
  },
  {
    id: "baked-potato",
    name: "Baked Potato",
    blurb: "Crisp skin, fluffy middle, loaded with cheese.",
    ingredients: ["potato", "cheese", "butter"],
    tags: ["side", "quick", "vegetarian"],
    minutes: 50,
    serves: 1,
  },
  {
    id: "mashed-potato",
    name: "Mashed Potatoes",
    blurb: "Buttery, creamy mash.",
    ingredients: ["potato", "butter", "milk"],
    tags: ["side", "vegetarian"],
    minutes: 30,
    serves: 4,
  },

  // ── Baking ──
  {
    id: "banana-bread",
    name: "Banana Bread",
    blurb: "Best way to use over-ripe bananas.",
    ingredients: ["banana", "flour", "egg", "sugar", "butter"],
    tags: ["baking", "vegetarian"],
    minutes: 70,
    serves: 8,
  },
  {
    id: "choc-chip-cookies",
    name: "Chocolate Chip Cookies",
    blurb: "Chewy in the middle, crisp at the edge.",
    ingredients: ["flour", "butter", "sugar", "egg", "chocolate"],
    tags: ["baking", "vegetarian"],
    minutes: 30,
    serves: 24,
  },
];
