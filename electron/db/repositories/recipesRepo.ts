import { getDb } from '../index'
import type { Recipe, RecipeIngredient, RecipeWithIngredients } from '../../../shared/types'

function joinRecipeRow(row: any): Recipe {
  return { ...row }
}

function joinRecipeWithIngredients(row: any): RecipeWithIngredients {
  return {
    ...row,
    ingredients: getDb().prepare(`
      SELECT ri.id, ri.recipe_id, ri.item_id, ri.item_name, ri.quantity, ri.unit
      FROM recipe_ingredients ri
      WHERE ri.recipe_id = ?
      ORDER BY ri.sort_order, ri.id
    `).all(row.id) as RecipeIngredient[],
  }
}

export const recipesRepo = {
  list(): RecipeWithIngredients[] {
    const rows = getDb().prepare(`
      SELECT r.*
      FROM recipes r
      WHERE r.active = 1
      ORDER BY r.name
    `).all() as any[]
    return rows.map(joinRecipeWithIngredients)
  },

  getAll(): RecipeWithIngredients[] {
    const rows = getDb().prepare(`
      SELECT r.*
      FROM recipes r
      ORDER BY r.name
    `).all() as any[]
    return rows.map(joinRecipeWithIngredients)
  },

  getById(id: number): RecipeWithIngredients | undefined {
    const row = getDb().prepare(`SELECT * FROM recipes WHERE id = ?`).get(id) as any
    return row ? joinRecipeWithIngredients(row) : undefined
  },

  create(data: { name: string; description?: string; servings?: number; ingredients: Array<{ item_id: number | null; item_name: string; quantity: number; unit: string }> }): Recipe {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO recipes (name, description, servings)
      VALUES (?, ?, ?)
    `).run(data.name, data.description ?? null, data.servings ?? 1)
    const recipeId = result.lastInsertRowid as number

    if (data.ingredients.length > 0) {
      const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (recipe_id, item_id, item_name, quantity, unit, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      const insert = db.transaction((ingredients: typeof data.ingredients) => {
        ingredients.forEach((ing, idx) => {
          insertIngredient.run(recipeId, ing.item_id, ing.item_name, ing.quantity, ing.unit ?? 'pcs', idx)
        })
      })
      insert(data.ingredients)
    }

    return this.getById(recipeId)!
  },

  update(id: number, data: { name?: string; description?: string | null; servings?: number; active?: number; ingredients?: Array<{ id?: number; item_id: number | null; item_name: string; quantity: number; unit: string }> }): Recipe | null {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as any
    if (!existing) return null

    if (data.name !== undefined) {
      db.prepare('UPDATE recipes SET name = ? WHERE id = ?').run(data.name, id)
    }
    if (data.description !== undefined) {
      db.prepare('UPDATE recipes SET description = ? WHERE id = ?').run(data.description, id)
    }
    if (data.servings !== undefined) {
      db.prepare('UPDATE recipes SET servings = ? WHERE id = ?').run(data.servings, id)
    }
    if (data.active !== undefined) {
      db.prepare('UPDATE recipes SET active = ? WHERE id = ?').run(data.active, id)
    }

    if (data.ingredients !== undefined) {
      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id)
      const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (recipe_id, item_id, item_name, quantity, unit, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      const insert = db.transaction((ingredients: typeof data.ingredients) => {
        ingredients.forEach((ing, idx) => {
          insertIngredient.run(id, ing.item_id, ing.item_name, ing.quantity, ing.unit ?? 'pcs', idx)
        })
      })
      insert(data.ingredients)
    }

    return this.getById(id) ?? null
  },

  del(id: number): void {
    getDb().prepare('DELETE FROM recipes WHERE id = ?').run(id)
  },
}
