import { useState } from 'react'
import { ChefHat, BookOpen, Trash2 } from 'lucide-react'
import { useRecipes } from '../../hooks/useRecipes'
import { useItems } from '../../hooks/useItems'
import { Markdown } from '../../components/ui/markdown'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { RecipeWithIngredients } from '../../../shared/types'

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

interface IngredientRow {
  id?: number
  item_id: number | null
  item_name: string
  quantity: number
  unit: string
}

export function RecipesPage() {
  const { recipes, loading, error: loadError, create, update, del } = useRecipes()
  const { items } = useItems({ kind: 'priced', activeOnly: true })

  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [detailRecipe, setDetailRecipe] = useState<RecipeWithIngredients | null>(null)
  const [editing, setEditing] = useState<RecipeWithIngredients | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState('1')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { item_id: null, item_name: '', quantity: 1, unit: 'pcs' },
  ])

  const recipesPager = usePagination(recipes)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setDescription('')
    setServings('1')
    setIngredients([{ item_id: null, item_name: '', quantity: 1, unit: 'pcs' }])
    setError('')
    setShowForm(true)
  }

  const openEdit = (r: RecipeWithIngredients) => {
    setEditing(r)
    setName(r.name)
    setDescription(r.description ?? '')
    setServings(String(r.servings))
    setIngredients(
      r.ingredients.map(g => ({
        id: g.id,
        item_id: g.item_id,
        item_name: g.item_name,
        quantity: g.quantity,
        unit: g.unit,
      })),
    )
    setError('')
    setShowForm(true)
  }

  const openDetail = (r: RecipeWithIngredients) => {
    setDetailRecipe(r)
    setShowDetail(true)
  }

  const addIngredient = () => {
    setIngredients(prev => [...prev, { item_id: null, item_name: '', quantity: 1, unit: 'pcs' }])
  }

  const updateIngredient = (idx: number, field: keyof IngredientRow, value: string | number) => {
    setIngredients(prev => prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)))
  }

  const removeIngredient = (idx: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const nameTrim = name.trim()
    if (!nameTrim) {
      setError('Recipe name is required')
      return
    }
    const servingsNum = parseInt(servings)
    if (isNaN(servingsNum) || servingsNum < 1) {
      setError('Servings must be at least 1')
      return
    }
    const validIngredients = ingredients.filter(g => g.item_name.trim() && g.quantity > 0)
    if (validIngredients.length === 0) {
      setError('Add at least one ingredient')
      return
    }

    setProcessing(true)
    try {
      const payload = {
        name: nameTrim,
        description: description.trim() || null,
        servings: servingsNum,
        ingredients: validIngredients.map(g => ({
          item_id: g.item_id,
          item_name: g.item_name.trim(),
          quantity: g.quantity,
          unit: g.unit.trim() || 'pcs',
        })),
      }
      if (editing) {
        await update(editing.id, {
          name: payload.name,
          description: payload.description,
          servings: payload.servings,
          ingredients: payload.ingredients,
        })
      } else {
        await create(payload)
      }
      setShowForm(false)
    } catch (err) {
      setError((err as Error).message || 'Failed to save recipe')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    try {
      await del(deleteId)
      setDeleteId(null)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recipes</h1>
        <span className="text-[0.9375rem] font-bold">Total: {recipes.length}</span>
        <Button onClick={openCreate} className="bg-primary font-semibold">
          + New Recipe
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : loadError ? (
        <p className="text-center font-semibold text-destructive">{loadError}</p>
      ) : recipes.length === 0 ? (
        <p className="p-12 text-center text-lg text-muted-foreground">No recipes yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="bg-card hover:bg-card">
                  <TableHead>Recipe</TableHead>
                  <TableHead className="text-center">Servings</TableHead>
                  <TableHead className="text-center">Ingredients</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipesPager.slice.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-center">{r.servings}</TableCell>
                    <TableCell className="text-center">
                      <Badge>{r.ingredients.length} items</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" className="h-8 border-border bg-background px-3 text-[0.8125rem] font-semibold" onClick={() => openDetail(r)} title="View recipe">
                          <BookOpen className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="h-8 border-border bg-background px-3 text-[0.8125rem] font-semibold" onClick={() => openEdit(r)}>
                          Edit
                        </Button>
                        <Button variant="outline" className="h-8 border-destructive/40 bg-background px-3 text-[0.8125rem] font-semibold text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationFooter pager={recipesPager} />
        </div>
      )}

      {/* Recipe detail dialog */}
      <Dialog open={showDetail} onOpenChange={(o) => { if (!o) { setShowDetail(false); setDetailRecipe(null) } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailRecipe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {detailRecipe.name}
                </DialogTitle>
                <DialogDescription>
                  {detailRecipe.servings} servings — {detailRecipe.ingredients.length} ingredients
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4">
                {detailRecipe.description && (
                  <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-muted/30 p-4">
                    <Markdown>{detailRecipe.description}</Markdown>
                  </div>
                )}

                <div>
                  <Label className="text-[0.875rem] font-semibold mb-2 flex items-center gap-1">
                    <ChefHat className="h-4 w-4" />
                    Structured Ingredients
                  </Label>
                  {detailRecipe.ingredients.length > 0 ? (
                    <Table className="table-zebra">
                      <TableHeader>
                        <TableRow className="bg-card hover:bg-card">
                          <TableHead>#</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-center">Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailRecipe.ingredients.map((ing, idx) => (
                          <TableRow key={ing.id ?? idx}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{ing.item_name}</TableCell>
                            <TableCell className="text-center">{ing.quantity}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{ing.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">No ingredients recorded.</p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowDetail(false); setDetailRecipe(null) }}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Recipe form dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Recipe' : 'New Recipe'}</DialogTitle>
            <DialogDescription>
              Define a recipe with its name, servings, and ingredient breakdown. Use markdown in the description for formatted recipes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <p className="m-0 font-semibold text-destructive">{error}</p>}

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Recipe name
              <Input value={name} onChange={e => setName(e.target.value)} className="h-11" placeholder="e.g. Boiled Chicken" autoFocus />
            </Label>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Description (markdown supported)
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="h-44 rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Use markdown for headings, tables, lists, bold text..."
                rows={8}
              />
            </Label>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Servings
              <Input type="number" min="1" value={servings} onChange={e => setServings(e.target.value)} className="h-11" />
            </Label>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[0.875rem] font-semibold">Ingredients</Label>
                <Button type="button" variant="outline" size="sm" className="h-8 border-border bg-background text-[0.8125rem] font-semibold" onClick={addIngredient}>
                  + Add Ingredient
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                    <div className="flex flex-col gap-1">
                      <Label className="text-[0.75rem] font-semibold text-muted-foreground">Item name</Label>
                      <Input
                        value={ing.item_name}
                        onChange={e => updateIngredient(idx, 'item_name', e.target.value)}
                        className="h-10"
                        placeholder="e.g. Goat Meat"
                        list={`ingredient-items-${idx}`}
                      />
                      <datalist id={`ingredient-items-${idx}`}>
                        {items.map(item => (
                          <option key={item.id} value={item.name} />
                        ))}
                      </datalist>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-[0.75rem] font-semibold text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={ing.quantity}
                        onChange={e => updateIngredient(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="h-10"
                        placeholder="1"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-[0.75rem] font-semibold text-muted-foreground">Unit</Label>
                      <Select
                        value={ing.unit}
                        onValueChange={v => updateIngredient(idx, 'unit', v)}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pcs">pcs</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="l">l</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="bunch">bunch</SelectItem>
                          <SelectItem value="cup">cup</SelectItem>
                          <SelectItem value="tablespoon">tablespoon</SelectItem>
                          <SelectItem value="teaspoon">teaspoon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {ingredients.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => removeIngredient(idx)}
                        title="Remove"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary font-semibold" disabled={processing}>
                {processing ? 'Saving...' : editing ? 'Update Recipe' : 'Create Recipe'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={o => { if (!o) setDeleteId(null) }}
        title="Delete this recipe?"
        description="This will permanently remove the recipe and all its ingredients."
        destructive
        confirmText="Delete"
        onConfirm={handleDelete}
      />
    </div>
  )
}
