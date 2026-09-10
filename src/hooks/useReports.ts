import { useState, useEffect, useCallback } from 'react'
import type { DailyReport, MonthlyReport, CategoryBreakdown, ProteinPerformance, DebtSummaryItem, TillSummaryData } from '../../shared/types'

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
  const [proteinPerf, setProteinPerf] = useState<ProteinPerformance[]>([])
  const [debtSummary, setDebtSummary] = useState<DebtSummaryItem[]>([])
  const [tillSummary, setTillSummary] = useState<TillSummaryData | null>(null)
  const [loading, setLoading] = useState(false)

  const loadDaily = useCallback(async (date: string) => {
    setLoading(true)
    const data = await window.api['reports:daily'](date, date)
    setDailyData(data)
    setLoading(false)
  }, [])

  const loadCustom = useCallback(async (start: string, end: string) => {
    setLoading(true)
    const data = await window.api['reports:daily'](start, end)
    setDailyData(data)
    setLoading(false)
  }, [])

  const loadMonthly = useCallback(async (year: number) => {
    setLoading(true)
    const data = await window.api['reports:monthly'](year)
    setMonthlyData(data)
    setLoading(false)
  }, [])

  const loadCategories = useCallback(async (start: string, end: string) => {
    const data = await window.api['reports:categoryBreakdown'](start, end)
    setCategories(data)
  }, [])

  const loadProteinPerf = useCallback(async (start: string, end: string) => {
    const data = await window.api['reports:proteinPerformance'](start, end)
    setProteinPerf(data)
  }, [])

  const loadDebts = useCallback(async () => {
    const data = await window.api['reports:debtSummary']()
    setDebtSummary(data)
  }, [])

  const loadTill = useCallback(async (tillSessionId: number) => {
    const data = await window.api['reports:tillSummary'](tillSessionId)
    setTillSummary(data)
  }, [])

  useEffect(() => {
    if (viewMode === 'daily') {
      loadDaily(selectedDate)
      loadCategories(selectedDate, selectedDate)
      loadProteinPerf(selectedDate, selectedDate)
    } else if (viewMode === 'monthly') {
      loadMonthly(selectedYear)
      const yearStart = `${selectedYear}-01-01`
      const yearEnd = `${selectedYear}-12-31`
      loadCategories(yearStart, yearEnd)
      loadProteinPerf(yearStart, yearEnd)
    } else {
      loadCustom(startDate, endDate)
      loadCategories(startDate, endDate)
      loadProteinPerf(startDate, endDate)
    }
    loadDebts()
  }, [viewMode, selectedDate, startDate, endDate, selectedYear, loadDaily, loadCustom, loadMonthly, loadCategories, loadProteinPerf, loadDebts])

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
    dailyData, monthlyData, categories, proteinPerf, debtSummary, tillSummary,
    loading,
    navigateDay,
    loadTill,
  }
}
