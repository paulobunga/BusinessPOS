#!/usr/bin/env node
/* Seed the Beef Gravy (Restaurant Recipe) into the BusinessPOS DB.
   Idempotent: skips if recipe already exists. Run with the app CLOSED. */

const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = process.env.BUSINESSPOS_DB || path.join(process.env.APPDATA || '', 'businesspos', 'businesspos.sqlite')

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found: ${dbPath}`)
  process.exit(1)
}

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

const existing = db.prepare('SELECT id FROM recipes WHERE name = ?').get('Beef Gravy')
if (existing) {
  console.log('Refusing: "Beef Gravy" recipe already exists (id: ' + existing.id + '). Delete it first to re-seed.')
  db.close()
  process.exit(0)
}

const run = db.transaction(() => {
  const insertRecipe = db.prepare('INSERT INTO recipes (name, description, servings) VALUES (?, ?, ?)')

  const description = `# Beef Gravy — Restaurant Recipe

**Style:** Rich, thick, savoury beef gravy
**Batch size:** Approximately 10–12 servings
**Preparation time:** 20 minutes
**Cooking time:** 45–60 minutes

---

## 1. Ingredients

### Beef

| Ingredient | Quantity |
| --- | ---: |
| Beef, cubed | 1 kg |
| Cooking oil | 4 tablespoons |

### Gravy Base

| Ingredient | Quantity |
| --- | ---: |
| Tomatoes | 5 medium |
| Carrots | 2 medium |
| Onions | 3 medium |
| Tomato paste | 2 tablespoons |
| Garlic | 4 cloves |
| Fresh ginger | 1 tablespoon |
| Green pepper | 1 large |

### Seasoning

| Ingredient | Quantity |
| --- | ---: |
| Soy sauce | 2 tablespoons |
| Beef stock cubes | 1–2 |
| Paprika | 1 tablespoon |
| Black pepper | 1 teaspoon |
| Curry powder | 1 teaspoon |
| Salt | To taste |

### Thickening

| Ingredient | Quantity |
| --- | ---: |
| Wheat flour | 2 tablespoons |
| Cold water | ½ cup |

### Cooking Liquid

| Ingredient | Quantity |
| --- | ---: |
| Water | 1–1.5 litres |

---

## 2. Prepare the Tomato & Carrot Base

### Boil the Tomatoes

1. Wash the tomatoes.
2. Place them in a pot of water.
3. Boil for approximately **5–8 minutes** until soft.
4. Remove and allow them to cool slightly.
5. Remove the skins if desired.

### Boil the Carrots

1. Peel and chop the carrots.
2. Boil until completely soft.
3. Drain and set aside.

### Blend

Add the following to a blender:

- Boiled tomatoes
- Boiled carrots
- 1–2 onions
- Garlic
- Fresh ginger
- Green pepper

Add a small amount of water and blend into a **smooth, thick sauce**.

> The boiled carrot adds body, natural sweetness and helps give the gravy a rich texture.

---

## 3. Prepare the Beef

1. Cut the beef into small, uniform cubes.
2. Season lightly with salt and black pepper.
3. Heat 4 tablespoons of cooking oil in a large saucepan.
4. Add the beef.
5. Brown the beef on all sides.
6. Remove the beef and set aside.

---

## 4. Cook the Gravy Base

Using the same saucepan:

1. Add the remaining chopped onion.
2. Fry until soft and lightly browned.
3. Add **2 tablespoons tomato paste**.
4. Fry the tomato paste for **2–3 minutes**, stirring continuously.
5. Pour in the blended tomato-carrot mixture.
6. Stir thoroughly.
7. Cook for approximately **8–10 minutes**.

Cooking the tomato paste before adding the liquid helps develop a deeper flavour and colour.

---

## 5. Add the Seasoning

Add:

- 1 tablespoon paprika
- 1 teaspoon curry powder
- 1 teaspoon black pepper
- 1–2 beef stock cubes
- **2 tablespoons soy sauce**

Mix thoroughly.

> **Important:** Add the salt gradually because **soy sauce and stock cubes already contain salt**.

---

## 6. Add the Beef

Return the browned beef to the gravy.

Mix thoroughly so that the beef is completely covered.

Add approximately **1 litre of hot water** and stir.

---

## 7. Simmer

1. Bring the gravy to a boil.
2. Reduce the heat.
3. Cover the saucepan.
4. Simmer for **30–45 minutes**.
5. Stir occasionally.
6. Add additional hot water if necessary.

Continue cooking until the beef is tender.

---

## 8. Thicken the Gravy

Mix:

- 2 tablespoons wheat flour
- ½ cup cold water

Stir until completely smooth.

Slowly pour the mixture into the simmering gravy while stirring continuously.

Simmer for another **5–10 minutes**.

The finished gravy should be:

- Thick
- Smooth
- Rich
- Glossy
- Easy to pour

---

## 9. Final Adjustment

Taste before serving.

**If too thick:** Add a little hot water.
**If too thin:** Allow it to simmer uncovered for several minutes.
**If too salty:** Add a little water and some additional blended tomato/carrot base if available.
**If too acidic:** Add a very small amount of sugar to balance the tomato flavour.
**If the flavour is weak:** Adjust with a small amount of soy sauce, beef stock or seasoning.

---

## 10. Serving

Serve hot with:

- Chips
- Rice
- Matooke
- Posho
- Chapati
- Irish potatoes
- Sweet potatoes
- Cassava

**Recommended Portion:** Approximately **100–120 g beef with gravy per serving**.

---

## 11. Restaurant Batch Formula

### Every 1 kg Beef

- 5 tomatoes
- 2 carrots
- 3 onions
- 1 green pepper
- 4 cloves garlic
- 1 tbsp ginger
- 2 tbsp tomato paste
- 2 tbsp soy sauce
- 1 tbsp paprika
- 1 tsp curry powder
- 1 tsp black pepper
- 1–2 beef stock cubes
- 2 tbsp flour
- 1–1.5 litres water
- 4 tbsp cooking oil

> **For a 5 kg beef batch, multiply the quantities by 5.**
`

  const recipeResult = insertRecipe.run('Beef Gravy', description, 10)
  const recipeId = recipeResult.lastInsertRowid

  const insertIngredient = db.prepare(`
    INSERT INTO recipe_ingredients (recipe_id, item_id, item_name, quantity, unit, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const ingredients = [
    { item_id: null, item_name: 'Beef (cubed)', quantity: 1, unit: 'kg', sort_order: 0 },
    { item_id: null, item_name: 'Cooking oil', quantity: 4, unit: 'tablespoon', sort_order: 1 },
    { item_id: null, item_name: 'Tomatoes', quantity: 5, unit: 'medium', sort_order: 5 },
    { item_id: null, item_name: 'Carrots', quantity: 2, unit: 'medium', sort_order: 6 },
    { item_id: null, item_name: 'Onions', quantity: 3, unit: 'medium', sort_order: 7 },
    { item_id: null, item_name: 'Tomato paste', quantity: 2, unit: 'tablespoon', sort_order: 8 },
    { item_id: null, item_name: 'Garlic', quantity: 4, unit: 'cloves', sort_order: 9 },
    { item_id: null, item_name: 'Fresh ginger', quantity: 1, unit: 'tablespoon', sort_order: 10 },
    { item_id: null, item_name: 'Green pepper', quantity: 1, unit: 'large', sort_order: 11 },
    { item_id: null, item_name: 'Soy sauce', quantity: 2, unit: 'tablespoon', sort_order: 15 },
    { item_id: null, item_name: 'Beef stock cubes', quantity: 1.5, unit: 'cube', sort_order: 16 },
    { item_id: null, item_name: 'Paprika', quantity: 1, unit: 'tablespoon', sort_order: 17 },
    { item_id: null, item_name: 'Black pepper', quantity: 1, unit: 'teaspoon', sort_order: 18 },
    { item_id: null, item_name: 'Curry powder', quantity: 1, unit: 'teaspoon', sort_order: 19 },
    { item_id: null, item_name: 'Salt', quantity: 0, unit: 'to taste', sort_order: 20 },
    { item_id: null, item_name: 'Wheat flour', quantity: 2, unit: 'tablespoon', sort_order: 24 },
    { item_id: null, item_name: 'Cold water', quantity: 0.5, unit: 'cup', sort_order: 25 },
    { item_id: null, item_name: 'Water', quantity: 1.25, unit: 'litre', sort_order: 29 },
  ]

  for (const ing of ingredients) {
    insertIngredient.run(recipeId, ing.item_id, ing.item_name, ing.quantity, ing.unit, ing.sort_order)
  }

  console.log('Recipe "Beef Gravy" created with id: ' + recipeId)
  console.log('Ingredients: ' + ingredients.length + ' items')
})

run()
db.close()
console.log('RECIPE SEED OK')
