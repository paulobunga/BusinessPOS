import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import type { SetupPayload, RawInputDraft, MealDraft, MealYieldDraft } from '../../../shared/types'

const inputClass = 'min-h-10 w-full rounded-[var(--radius-md)] border-border bg-background text-[0.875rem]'
const pinClass = `${inputClass} max-w-[140px] text-center text-base font-bold tracking-[8px]`
const selectClass = 'h-11 w-full rounded-[var(--radius-md)]'
const UNITS = ['kg', 'pieces', 'litres', 'bags', 'boxes', 'heads', 'dozen']
const STEPS = ['Business Info', 'Manager Account', 'Menu & Stock']

const toMoney = (s: string) => {
  const n = Number(s)
  if (s.trim() === '' || isNaN(n)) return 0
  return Math.max(0, Math.round(n))
}

export function SetupPage({ onComplete }: { onComplete: () => void }) {
  const { login } = useAuth()

  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [managerName, setManagerName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  const [rawInputs, setRawInputs] = useState<RawInputDraft[]>([])
  const [meals, setMeals] = useState<MealDraft[]>([])

  const patchRaw = (i: number, p: Partial<RawInputDraft>) =>
    setRawInputs(rs => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  const patchMeal = (i: number, p: Partial<MealDraft>) =>
    setMeals(ms => ms.map((m, idx) => (idx === i ? { ...m, ...p } : m)))
  const patchYield = (mi: number, yi: number, p: Partial<MealYieldDraft>) =>
    setMeals(ms => ms.map((m, idx) =>
      idx === mi ? { ...m, yields: m.yields.map((y, yIdx) => (yIdx === yi ? { ...y, ...p } : y)) } : m
    ))

  const advance = () => {
    if (step === 0 && !businessName.trim()) { setError('Enter your business name'); return }
    if (step === 1) {
      if (!managerName.trim()) { setError('Enter the manager name'); return }
      if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(confirmPin)) { setError('PIN must be 4 digits'); return }
      if (pin !== confirmPin) { setError('PINs do not match'); return }
    }
    setError(null)
    setStep(s => Math.min(STEPS.length - 1, s + 1))
  }

  const finish = async () => {
    if (meals.length === 0) { setError('Add at least one meal'); return }
    if (meals.some(m => !m.name.trim() || toMoney(String(m.sellingPrice)) <= 0)) {
      setError('Every meal needs a name and a selling price above 0'); return
    }
    if (rawInputs.some(r => !r.name.trim())) { setError('Every stock item needs a name'); return }
    setError(null)
    setSaving(true)
    try {
      const payload: SetupPayload = {
        businessName: businessName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        managerName: managerName.trim(),
        managerPin: pin,
        rawInputs: rawInputs.filter(r => r.name.trim()).map(r => ({
          name: r.name.trim(),
          unit: r.unit || 'kg',
          costPerUnit: toMoney(String(r.costPerUnit)),
        })),
        meals: meals.filter(m => m.name.trim()).map(m => ({
          name: m.name.trim(),
          category: m.category.trim() || 'Meals',
          sellingPrice: toMoney(String(m.sellingPrice)),
          costPerServing: toMoney(String(m.costPerServing)),
          yields: m.yields.filter(y => y.rawInputName && toMoney(String(y.portions)) > 0).map(y => ({
            rawInputName: y.rawInputName,
            portions: toMoney(String(y.portions)),
          })),
        })),
      }
      await window.api['setup:save'](payload)
      const ok = await login(payload.managerPin)
      if (!ok) { setError('Setup saved, but could not log you in. Please restart the app.'); setSaving(false); return }
      onComplete()
    } catch (e: any) {
      setError(e?.message ?? 'Setup failed. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-2xl rounded-[var(--radius-lg)] border border-border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="m-0 text-2xl font-bold text-foreground">Set up your business</h1>
          <p className="m-0 mt-1 text-[0.875rem] text-muted-foreground">
            Tell us about your business and what you will be selling.
          </p>
        </div>

        {/* Step indicator */}
        <ol className="mb-6 flex items-center gap-1">
          {STEPS.map((name, i) => (
            <li key={name} className="flex min-w-0 flex-1 items-center gap-1">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-bold ${
                  i < step
                    ? 'bg-primary text-white'
                    : i === step
                    ? 'border-2 border-primary text-primary'
                    : 'border border-border text-muted-foreground'
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`ml-1 hidden truncate text-[0.8125rem] font-semibold sm:block ${
                  i <= step ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {name}
              </span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        {/* Step content */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Business name
              <Input className={inputClass} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Kafunda Kitchen" autoFocus />
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Phone (optional)
                <Input className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} placeholder="0700 000 000" />
              </Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Address (optional)
                <Input className={inputClass} value={address} onChange={e => setAddress(e.target.value)} placeholder="Kampala" />
              </Label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Manager name
              <Input className={inputClass} value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="e.g. John" autoFocus />
            </Label>
            <div className="flex flex-wrap items-end gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                4-digit PIN
                <Input className={pinClass} type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
              </Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Confirm PIN
                <Input className={pinClass} type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} />
              </Label>
            </div>
            <p className="m-0 text-[0.8125rem] text-muted-foreground">
              You will use this PIN to log in to the app.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h2 className="m-0 text-base font-bold">Stock items <span className="font-normal text-muted-foreground">(optional)</span></h2>
              {rawInputs.map((r, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3 rounded-[var(--radius-md)] border border-border bg-background p-3">
                  <Label className="flex min-w-[150px] flex-1 flex-col gap-1 text-[0.8125rem] font-semibold">
                    Name
                    <Input className={inputClass} value={r.name} onChange={e => patchRaw(i, { name: e.target.value })} placeholder="e.g. Whole Chicken" />
                  </Label>
                  <Label className="flex w-[130px] flex-col gap-1 text-[0.8125rem] font-semibold">
                    Unit
                    <Select value={r.unit || 'kg'} onValueChange={v => patchRaw(i, { unit: v })}>
                      <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Label>
                  <Label className="flex w-[140px] flex-col gap-1 text-[0.8125rem] font-semibold">
                    Cost per unit (UGX)
                    <Input className={inputClass} type="number" min="0" value={r.costPerUnit === 0 ? '' : r.costPerUnit} onChange={e => patchRaw(i, { costPerUnit: toMoney(e.target.value) })} placeholder="17000" />
                  </Label>
                  <Button variant="outline" className="h-10 w-10 p-0 border-destructive text-destructive" onClick={() => setRawInputs(rs => rs.filter((_, idx) => idx !== i))} aria-label="Remove stock item">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="h-11 w-fit border-border bg-card font-semibold" onClick={() => setRawInputs(rs => [...rs, { name: '', unit: 'kg', costPerUnit: 0 }])}>
                <Plus className="mr-1 h-4 w-4" /> Add Stock Item
              </Button>
              <p className="m-0 text-[0.8125rem] text-muted-foreground">
                Stock items are ingredients you buy in bulk. They stay hidden on the POS screen — you can also add them later from Inventory.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="m-0 text-base font-bold">Meals</h2>
              {meals.map((m, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-background p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <Label className="flex min-w-[150px] flex-1 flex-col gap-1 text-[0.8125rem] font-semibold">
                      Meal name
                      <Input className={inputClass} value={m.name} onChange={e => patchMeal(i, { name: e.target.value })} placeholder="e.g. Roast Chicken" />
                    </Label>
                    <Label className="flex w-[130px] flex-col gap-1 text-[0.8125rem] font-semibold">
                      Category
                      <Input className={inputClass} value={m.category} onChange={e => patchMeal(i, { category: e.target.value })} placeholder="Meals" />
                    </Label>
                    <Label className="flex w-[140px] flex-col gap-1 text-[0.8125rem] font-semibold">
                      Selling price (UGX)
                      <Input className={inputClass} type="number" min="0" value={m.sellingPrice === 0 ? '' : m.sellingPrice} onChange={e => patchMeal(i, { sellingPrice: toMoney(e.target.value) })} placeholder="12000" />
                    </Label>
                    <Label className="flex w-[150px] flex-col gap-1 text-[0.8125rem] font-semibold">
                      Cost per serving (optional)
                      <Input className={inputClass} type="number" min="0" value={m.costPerServing === 0 ? '' : m.costPerServing} onChange={e => patchMeal(i, { costPerServing: toMoney(e.target.value) })} placeholder="4000" />
                    </Label>
                    <Button variant="outline" className="h-10 w-10 p-0 border-destructive text-destructive" onClick={() => setMeals(ms => ms.filter((_, idx) => idx !== i))} aria-label="Remove meal">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <p className="m-0 text-[0.8125rem] font-semibold text-muted-foreground">Made from stock items</p>
                    {m.yields.map((y, yi) => (
                      <div key={yi} className="flex flex-wrap items-end gap-3">
                        <Label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[0.8125rem] font-semibold">
                          Stock item
                          <Select value={y.rawInputName} onValueChange={v => patchYield(i, yi, { rawInputName: v })}>
                            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {rawInputs.filter(r => r.name.trim()).map(r => (
                                <SelectItem key={r.name.trim()} value={r.name.trim()}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Label>
                        <Label className="flex w-[130px] flex-col gap-1 text-[0.8125rem] font-semibold">
                          Portions served
                          <Input className={inputClass} type="number" min="1" value={y.portions === 0 ? '' : y.portions} onChange={e => patchYield(i, yi, { portions: toMoney(e.target.value) })} placeholder="5" />
                        </Label>
                        <Button variant="outline" className="h-10 w-10 p-0 border-destructive text-destructive" onClick={() => patchMeal(i, { yields: m.yields.filter((_, yi2) => yi2 !== yi) })} aria-label="Remove yield">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" className="h-9 w-fit border-border bg-card text-[0.8125rem] font-semibold" disabled={rawInputs.length === 0} onClick={() => patchMeal(i, { yields: [...m.yields, { rawInputName: rawInputs[0]?.name ?? '', portions: 0 }] })}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add stock item link
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="h-11 w-fit border-border bg-card font-semibold" onClick={() => setMeals(ms => [...ms, { name: '', category: '', sellingPrice: 0, costPerServing: 0, yields: [] }])}>
                <Plus className="mr-1 h-4 w-4" /> Add Meal
              </Button>
              <p className="m-0 text-[0.8125rem] text-muted-foreground">
                Meals are what you sell on the POS screen. Linking them to stock items pre-fills yield suggestions when you record purchases.
              </p>
            </div>
          </div>
        )}

        {error && <p className="m-0 mt-4 text-[0.875rem] font-semibold text-destructive">{error}</p>}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            className="h-11 border-border bg-card font-semibold"
            disabled={step === 0 || saving}
            onClick={() => { setError(null); setStep(s => Math.max(0, s - 1)) }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button
            className="h-11 bg-primary font-semibold"
            onClick={step === STEPS.length - 1 ? finish : advance}
            disabled={saving}
          >
            {step === STEPS.length - 1 ? 'Finish Setup' : 'Continue'} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
