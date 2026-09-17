#!/usr/bin/env node
/* Seed the Feza Dipping Sauce recipe into the BusinessPOS DB.
   Pairs with Feza Chicken (KFC-Style Crispy Chicken).
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

const existing = db.prepare('SELECT id FROM recipes WHERE name = ?').get('Feza Dipping Sauce')
if (existing) {
  console.log('Refusing: "Feza Dipping Sauce" recipe already exists (id: ' + existing.id + '). Delete it first to re-seed.')
  db.close()
  process.exit(0)
}

const run = db.transaction(() => {
  const insertRecipe = db.prepare('INSERT INTO recipes (name, description, servings) VALUES (?, ?, ?)')

  const description = `# Feza Dipping Sauce

**Pairs with:** Feza Chicken (KFC-Style Crispy Chicken)
**Makes:** Approximately 1 cup of sauce

---

## 1. Ingredients

| Ingredient | Quantity |
| --- | ---: |
| Ketchup | 1 cup |
| Boiled eggs | 4 |
| Mustard powder | 1 tablespoon |
| White vinegar | 1–2 tablespoons |
| Salt | To taste |
| Black pepper | ½ teaspoon, optional |
| Water | As needed |

---

## 2. Preparation

1. Boil **4 eggs** until fully cooked.
2. Cool and peel the eggs.
3. Mash or blend the eggs.
4. Add **1 cup ketchup**.
5. Add **1 tablespoon mustard powder**.
6. Add **1–2 tablespoons white vinegar**.
7. Add salt to taste.
8. Add ½ teaspoon black pepper if desired.
9. Blend or mix until smooth.
10. Add a small amount of water if the sauce is too thick.

> Taste and adjust the **salt, vinegar and mustard** according to preference.
`

  const recipeResult = insertRecipe.run('Feza Dipping Sauce', description, 4)
  const recipeId = recipeResult.lastInsertRowid

  const insertIngredient = db.prepare(`
    INSERT INTO recipe_ingredients (recipe_id, item_id, item_name, quantity, unit, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const ingredients = [
    { item_id: null, item_name: 'Ketchup', quantity: 1, unit: 'cup', sort_order: 0 },
    { item_id: null, item_name: 'Eggs (boiled)', quantity: 4, unit: 'pcs', sort_order: 1 },
    { item_id: null, item_name: 'Mustard powder', quantity: 1, unit: 'tablespoon', sort_order: 2 },
    { item_id: null, item_name: 'White vinegar', quantity: 1.5, unit: 'tablespoon', sort_order: 3 },
    { item_id: null, item_name: 'Salt', quantity: 0, unit: 'to taste', sort_order: 4 },
    { item_id: null, item_name: 'Black pepper', quantity: 0.5, unit: 'teaspoon', sort_order: 5 },
    { item_id: null, item_name: 'Water', quantity: 1, unit: 'as needed', sort_order: 6 },
  ]

  for (const ing of ingredients) {
    insertIngredient.run(recipeId, ing.item_id, ing.item_name, ing.quantity, ing.unit, ing.sort_order)
  }

  console.log('Recipe "Feza Dipping Sauce" created with id: ' + recipeId)
  console.log('Ingredients: ' + ingredients.length + ' items')
})

run()
db.close()
console.log('RECIPE SEED OK')
