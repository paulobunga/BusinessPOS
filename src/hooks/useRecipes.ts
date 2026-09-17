import { useState, useEffect, useCallback } from 'react'
import type { Recipe, RecipeWithIngredients, CreateRecipePayload, UpdateRecipePayload } from '../../shared/types'

export function useRecipes() {
  const [recipes, setRecipes] = useState<RecipeWithIngredients[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['recipes:list']()
      setRecipes(data as RecipeWithIngredients[])
    } catch (err) {
      setError((err as Error).message || 'Failed to load recipes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const create = useCallback(async (payload: CreateRecipePayload) => {
    const result = await window.api['recipes:create'](payload)
    await refresh()
    return result
  }, [refresh])

  const update = useCallback(async (id: number, payload: UpdateRecipePayload) => {
    const result = await window.api['recipes:update'](id, payload)
    await refresh()
    return result
  }, [refresh])

  const del = useCallback(async (id: number) => {
    await window.api['recipes:delete'](id)
    await refresh()
  }, [refresh])

  return { recipes, loading, error, create, update, del, refresh }
}
