#!/usr/bin/env node
/* Seed the Feza Chicken (KFC-Style Crispy Chicken) recipe into the BusinessPOS DB.
   Note: Dipping Sauce is a separate recipe ("Feza Dipping Sauce").
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

const existing = db.prepare('SELECT id FROM recipes WHERE name = ?').get('Feza Chicken')
if (existing) {
  console.log('Refusing: "Feza Chicken" recipe already exists (id: ' + existing.id + '). Delete it first to re-seed.')
  db.close()
  process.exit(0)
}

const run = db.transaction(() => {
  const insertRecipe = db.prepare('INSERT INTO recipes (name, description, servings) VALUES (?, ?, ?)')

  const description = `# Feza Chicken — KFC-Style Crispy Chicken

**Style:** KFC-style crispy fried chicken
**Batch:** 1 chicken pack
**Chicken cost:** UGX 32,000
**Preparation time:** 15–20 minutes
**Marinating time:** 2–12 hours
**Cooking time:** Approximately 15–25 minutes, depending on piece size
**Method:** Deep frying

---

## 1. Ingredients

### Chicken & Marinade

| Ingredient | Quantity |
| --- | ---: |
| Chicken | 1 pack — UGX 32,000 |
| Milk | 500 ml |
| White vinegar | 1 tablespoon |
| Salt | 1–2 teaspoons |
| Garlic powder | 1 tablespoon |
| Ground ginger | 1 tablespoon |
| Black pepper | 1 teaspoon |

### Crispy Flour Coating

| Ingredient | Quantity |
| --- | ---: |
| Supreme wheat flour | 2 cups |
| Garlic powder | 1 tablespoon |
| Paprika | 2 tablespoons |
| White pepper | 1 tablespoon |
| Ground ginger | 1 tablespoon |
| Black pepper | 1 teaspoon |
| Salt | 1–2 teaspoons |

### For Frying

| Ingredient | Quantity |
| --- | ---: |
| Cooking oil | Enough for deep frying |

---

## 2. Preparation

### Step 1 — Prepare the Marinade

1. Pour **500 ml of milk** into a large bowl.
2. Add **1 tablespoon of white vinegar**.
3. Add:
   - 1 tablespoon garlic powder
   - 1 tablespoon ground ginger
   - 1 teaspoon black pepper
   - 1–2 teaspoons salt
4. Mix thoroughly.
5. Add the chicken pieces.
6. Make sure every piece is completely covered by the marinade.
7. Cover the bowl and refrigerate.

> **Minimum marinating time:** 2 hours
> **Recommended:** 6–12 hours for better flavour.

### Step 2 — Prepare the Crispy Coating

In a large bowl, combine:

- 2 cups Supreme wheat flour
- 1 tablespoon garlic powder
- 2 tablespoons paprika
- 1 tablespoon white pepper
- 1 tablespoon ground ginger
- 1 teaspoon black pepper
- 1–2 teaspoons salt

Mix the flour and spices thoroughly so that the seasoning is evenly distributed.

### Step 3 — Coat the Chicken

For each piece:

1. Remove the chicken from the marinade.
2. Allow excess milk to drip off.
3. Place the chicken into the seasoned flour.
4. Press and squeeze the flour onto the chicken so it sticks properly.
5. Shake off excess flour.

#### Extra-Crispy Method

For a thicker coating:

**Marinade → Flour → Marinade → Flour**

The second flour coating creates the rough, crispy texture.

### Step 4 — Fry the Chicken

1. Fill a deep frying pot or fryer with enough cooking oil to completely or mostly cover the chicken.
2. Heat the oil to approximately **170–175°C**.
3. Carefully add the chicken pieces.
4. Do not overcrowd the fryer.
5. Fry in batches if necessary.
6. Cook until the outside is **golden brown and crispy** and the chicken is fully cooked inside.
7. Remove and place on a wire rack or paper towels to drain excess oil.

> **Food safety:** Chicken should reach an internal temperature of at least **74°C** at the thickest part.

---

## 3. Serving

Serve the chicken **hot and crispy** with the Feza Dipping Sauce.

Suggested serving:

- 1–2 pieces of crispy chicken
- Dipping sauce
- Chips/fries or another side dish
- Optional salad/coleslaw

---

## 4. Complete Shopping List

### Meat & Dairy

- [ ] Chicken — 1 pack — **UGX 32,000**
- [ ] Milk — **500 ml**
- [ ] Eggs — **4**

### Flour & Dry Ingredients

- [ ] Supreme wheat flour — **2 cups**
- [ ] Garlic powder
- [ ] Paprika
- [ ] White pepper
- [ ] Black pepper
- [ ] Ground ginger
- [ ] Mustard powder
- [ ] Salt

### Sauces & Vinegar

- [ ] Ketchup — **1 cup**
- [ ] White vinegar

### Cooking

- [ ] Cooking oil — sufficient for deep frying

---

## 5. Kitchen Prep Checklist

Before starting service, make sure you have:

- [ ] Chicken portioned
- [ ] Marinade prepared
- [ ] Chicken marinated
- [ ] Seasoned flour prepared
- [ ] Eggs boiled
- [ ] Dipping sauce prepared (see Feza Dipping Sauce recipe)
- [ ] Cooking oil ready
- [ ] Frying equipment clean
- [ ] Drainage rack/tray ready
- [ ] Serving containers ready

---

> **Batch Notes:** Record the actual number and weight of chicken pieces in one UGX 32,000 pack. This allows the restaurant to calculate the exact cost per piece, cost per plate, and profit margin rather than estimating by batch.
`

  const recipeResult = insertRecipe.run('Feza Chicken', description, 2)
  const recipeId = recipeResult.lastInsertRowid

  const insertIngredient = db.prepare(`
    INSERT INTO recipe_ingredients (recipe_id, item_id, item_name, quantity, unit, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const ingredients = [
    { item_id: null, item_name: 'Chicken (1 pack)', quantity: 1, unit: 'pack', sort_order: 0 },
    { item_id: null, item_name: 'Milk', quantity: 500, unit: 'ml', sort_order: 1 },
    { item_id: null, item_name: 'White vinegar', quantity: 1, unit: 'tablespoon', sort_order: 2 },
    { item_id: null, item_name: 'Salt', quantity: 1.5, unit: 'teaspoon', sort_order: 3 },
    { item_id: null, item_name: 'Garlic powder', quantity: 1, unit: 'tablespoon', sort_order: 4 },
    { item_id: null, item_name: 'Ground ginger', quantity: 1, unit: 'tablespoon', sort_order: 5 },
    { item_id: null, item_name: 'Black pepper', quantity: 1, unit: 'teaspoon', sort_order: 6 },
    { item_id: null, item_name: 'Supreme wheat flour', quantity: 2, unit: 'cup', sort_order: 10 },
    { item_id: null, item_name: 'Garlic powder', quantity: 1, unit: 'tablespoon', sort_order: 11 },
    { item_id: null, item_name: 'Paprika', quantity: 2, unit: 'tablespoon', sort_order: 12 },
    { item_id: null, item_name: 'White pepper', quantity: 1, unit: 'tablespoon', sort_order: 13 },
    { item_id: null, item_name: 'Ground ginger', quantity: 1, unit: 'tablespoon', sort_order: 14 },
    { item_id: null, item_name: 'Black pepper', quantity: 1, unit: 'teaspoon', sort_order: 15 },
    { item_id: null, item_name: 'Salt', quantity: 1.5, unit: 'teaspoon', sort_order: 16 },
    { item_id: null, item_name: 'Cooking oil', quantity: 1, unit: 'as needed', sort_order: 20 },
  ]

  for (const ing of ingredients) {
    insertIngredient.run(recipeId, ing.item_id, ing.item_name, ing.quantity, ing.unit, ing.sort_order)
  }

  console.log('Recipe "Feza Chicken" created with id: ' + recipeId)
  console.log('Ingredients: ' + ingredients.length + ' items')
})

run()
db.close()
console.log('RECIPE SEED OK')
