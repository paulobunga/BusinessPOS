import { useState, useEffect, useCallback } from 'react'
import type { DailyReport, MonthlyReport, CategoryBreakdown, ItemPerformance, DebtSummaryItem, TillSummaryData, SaleWithItems } from '../../shared/types'

export type ViewMode = 'daily' | 'monthly' | 'custom'

export function useReports() {
  const today = new Date().toISOString().slice(0, 10)
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [selectedDate, setSelectedDate] = useState(today)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [selectedYear] = useState(new Date().getFullYear())

  const [dailyData, setDailyData] = useState<DailyReport[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyReport[]>([])
  const [categories, setCategories] = useState<CategoryBreakdown[]>([])
  const [itemPerf, setItemPerf] = useState<ItemPerformance[]>([])
  const [debtSummary, setDebtSummary] = useState<DebtSummaryItem[]>([])
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [tillSummary, setTillSummary] = useState<TillSummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDaily = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['reports:daily'](date, date)
      setDailyData(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCustom = useCallback(async (start: string, end: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['reports:daily'](start, end)
      setDailyData(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMonthly = useCallback(async (year: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['reports:monthly'](year)
      setMonthlyData(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = useCallback(async (start: string, end: string) => {
    try {
      const data = await window.api['reports:categoryBreakdown'](start, end)
      setCategories(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to load categories')
    }
  }, [])

  const loadItemPerf = useCallback(async (start: string, end: string) => {
    try {
      const data = await window.api['reports:itemPerformance'](start, end)
      setItemPerf(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to load item performance')
    }
  }, [])

  const loadDebts = useCallback(async () => {
    try {
      const data = await window.api['reports:debtSummary']()
      setDebtSummary(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to load debt summary')
    }
  }, [])

  const loadSales = useCallback(async (start: string, end: string) => {
    try {
      const data = await window.api['reports:sales'](start, end)
      setSales(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to load sales')
    }
  }, [])

  const loadTill = useCallback(async (tillSessionId: number) => {
    try {
      const data = await window.api['reports:tillSummary'](tillSessionId)
      setTillSummary(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to load till summary')
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'daily') {
      loadDaily(selectedDate)
      loadSales(selectedDate, selectedDate)
      loadCategories(selectedDate, selectedDate)
      loadItemPerf(selectedDate, selectedDate)
    } else if (viewMode === 'monthly') {
      loadMonthly(selectedYear)
      const yearStart = `${selectedYear}-01-01`
      const yearEnd = `${selectedYear}-12-31`
      loadSales(yearStart, yearEnd)
      loadCategories(yearStart, yearEnd)
      loadItemPerf(yearStart, yearEnd)
    } else {
      loadCustom(startDate, endDate)
      loadSales(startDate, endDate)
      loadCategories(startDate, endDate)
      loadItemPerf(startDate, endDate)
    }
    loadDebts()
  }, [viewMode, selectedDate, startDate, endDate, selectedYear, loadDaily, loadCustom, loadMonthly, loadSales, loadCategories, loadItemPerf, loadDebts])

  const navigateDay = (offset: number) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().slice(0, 10))
  }

  return {
    viewMode, setViewMode,
    selectedDate, setSelectedDate,
    startDate, setStartDate,
    endDate, setEndDate,
    selectedYear,
    dailyData, monthlyData, categories, itemPerf, debtSummary, sales, tillSummary,
    loading, error,
    navigateDay,
    loadTill,
  }
}