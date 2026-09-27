import { useState, useEffect, useCallback } from 'react'
import { getEthiopianToday, formatEthDate, estimateFinishDate, ethMonths } from './utils/ethiopian'
import { loadData, saveData } from './utils/storage'

function App() {
  const [data, setData] = useState(null)
  const [screen, setScreen] = useState('selector') // login | selector | equb-home | members | member-detail | calendar | create | settings
  const [currentEqubId, setCurrentEqubId] = useState(null)
  const [currentMemberId, setCurrentMemberId] = useState(null)
  const [toast, setToast] = useState('')
  const [showToast, setShowToast] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newMembers, setNewMembers] = useState('')
  const [newLateFee, setNewLateFee] = useState('50')
  const [cycleType, setCycleType] = useState('weekly')
  const [cycleDay, setCycleDay] = useState('Sunday')

  // Calendar
  const [calMonth, setCalMonth] = useState(getEthiopianToday().monthIndex)
  const [calYear, setCalYear] = useState(getEthiopianToday().year)

  // Lottery
  const [lotteryOpen, setLotteryOpen] = useState(false)
  const [winnerOpen, setWinnerOpen] = useState(false)
  const [selectedWinner, setSelectedWinner] = useState(null)

  // Add member
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addPhone, setAddPhone] = useState('')

  // SMS
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsTo, setSmsTo] = useState('')
  const [smsBody, setSmsBody] = useState('')

  useEffect(() => {
    loadData().then(d => {
      setData(d)
    })
  }, [])

  const persist = useCallback(async (next) => {
    setData(next)
    await saveData(next)
  }, [])

  const showMsg = (msg) => {
    setToast(msg)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2500)
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">Loading...</p>
      </div>
    )
  }

  const equbs = data.equbs || {}
  const currentEqub = currentEqubId ? equbs[currentEqubId] : null
  const currentMember = currentEqub?.members?.find(m => m.id === currentMemberId)

  // ========== HELPERS ==========
  function getMemberCycleStatus(member, cycle) {
    return member?.payments?.[cycle]?.status || 'pending'
  }

  function initials(name) {
    return (name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  // ========== CREATE EQUB ==========
  async function handleCreateEqub() {
    if (!newName.trim() || !newAmount || !newMembers) {
      showMsg('Fill all required fields')
      return
    }
    const today = getEthiopianToday()
    const total = parseInt(newMembers)
    const id = 'eq_' + Date.now()
    const next = {
      ...data,
      equbs: {
        ...data.equbs,
        [id]: {
          id,
          name: newName.trim(),
          amount: parseInt(newAmount),
          cycleType,
          cycleDay,
          totalMembers: total,
          currentCycle: 1,
          lateFee: parseInt(newLateFee) || 50,
          startDate: { year: today.year, monthIndex: today.monthIndex, day: today.day },
          finishDate: estimateFinishDate(today, cycleType, total),
          members: [],
          collections: []
        }
      }
    }
    await persist(next)
    setNewName(''); setNewAmount(''); setNewMembers(''); setNewLateFee('50')
    showMsg('New Equb created – completely separate ledger')
    setScreen('selector')
  }

  // ========== OPEN EQUB ==========
  function openEqub(id) {
    setCurrentEqubId(id)
    setScreen('equb-home')
  }

  // ========== TOGGLE PAYMENT (per cycle) ==========
  async function togglePaid(memberId) {
    if (!currentEqub) return
    const cycle = currentEqub.currentCycle || 1
    const members = currentEqub.members.map(m => {
      if (m.id !== memberId) return m
      const payments = { ...(m.payments || {}) }
      const current = payments[cycle]?.status || 'pending'
      const nextStatus = current === 'paid' ? 'pending' : 'paid'
      payments[cycle] = {
        status: nextStatus,
        date: getEthiopianToday().formatted,
        lateFee: 0
      }
      return { ...m, payments }
    })
    const next = {
      ...data,
      equbs: {
        ...data.equbs,
        [currentEqubId]: { ...currentEqub, members }
      }
    }
    await persist(next)
    const m = members.find(x => x.id === memberId)
    const st = getMemberCycleStatus(m, cycle)
    showMsg(st === 'paid' ? `${m.name.split(' ')[0]} paid for Cycle ${cycle}` : `Unmarked Cycle ${cycle}`)
  }

  // ========== ADD MEMBER ==========
  async function handleAddMember() {
    if (!addName.trim() || !addPhone.trim()) {
      showMsg('Name and phone required')
      return
    }
    const member = {
      id: Date.now(),
      name: addName.trim(),
      phone: addPhone.trim(),
      payments: {},
      wonCycle: null
    }
    const next = {
      ...data,
      equbs: {
        ...data.equbs,
        [currentEqubId]: {
          ...currentEqub,
          members: [...(currentEqub.members || []), member]
        }
      }
    }
    await persist(next)
    setAddName(''); setAddPhone('')
    setAddMemberOpen(false)
    showMsg(member.name + ' added to this Equb only')
  }

  // ========== LOTTERY ==========
  function openLottery() {
    setLotteryOpen(true)
  }

  function runLottery() {
    const eligible = (currentEqub?.members || []).filter(m => !m.wonCycle)
    if (!eligible.length) {
      showMsg('No eligible members')
      return
    }
    const winner = eligible[Math.floor(Math.random() * eligible.length)]
    setSelectedWinner(winner)
    setLotteryOpen(false)
    setWinnerOpen(true)
  }

  function selectWinnerManually(m) {
    setSelectedWinner(m)
    setLotteryOpen(false)
    setWinnerOpen(true)
  }

  async function confirmWinner() {
    if (!selectedWinner || !currentEqub) return
    const cycle = currentEqub.currentCycle || 1
    const members = currentEqub.members.map(m =>
      m.id === selectedWinner.id ? { ...m, wonCycle: cycle } : m
    )
    const paidCount = members.filter(m => getMemberCycleStatus(m, cycle) === 'paid').length
    const collections = [
      {
        cycle,
        date: getEthiopianToday().formatted,
        collected: currentEqub.amount * paidCount,
        paid: paidCount,
        total: members.length,
        winner: selectedWinner.name
      },
      ...(currentEqub.collections || [])
    ]
    const next = {
      ...data,
      equbs: {
        ...data.equbs,
        [currentEqubId]: {
          ...currentEqub,
          members,
          collections,
          currentCycle: cycle + 1
        }
      }
    }
    await persist(next)
    setWinnerOpen(false)
    setSelectedWinner(null)
    showMsg('Winner recorded for this Equb')
  }

  // ========== SMS ==========
  function openSms(member) {
    const template = (data.settings?.smsTemplate || 'Selam [Name], please pay [Amount] Birr for cycle [Cycle].')
      .replace('[Name]', member.name.split(' ')[0])
      .replace('[Amount]', currentEqub.amount)
      .replace('[Cycle]', currentEqub.currentCycle || 1)
    setSmsTo(member.phone)
    setSmsBody(template)
    setSmsOpen(true)
  }

  function sendSms() {
    const phone = smsTo.replace(/\s/g, '')
    const body = encodeURIComponent(smsBody)
    window.open(`sms:${phone}?body=${body}`, '_self')
    setSmsOpen(false)
  }

  // ========== RENDER HELPERS ==========
  const paidThisCycle = currentEqub
    ? (currentEqub.members || []).filter(m => getMemberCycleStatus(m, currentEqub.currentCycle || 1) === 'paid').length
    : 0

  // ========== SCREENS ==========
  function renderSelector() {
    const ids = Object.keys(equbs)
    return (
      <div className="pb-8">
        <div className="header" style={{ paddingBottom: 28 }}>
          <p className="text-white/80 text-sm">Welcome</p>
          <h1 className="text-xl font-bold">Equb Admin</h1>
          <p className="text-white/80 text-sm mt-2">Each Equb is a separate ledger — no data shared</p>
        </div>
        <div className="px-4 pt-4 space-y-3">
          {ids.length === 0 && (
            <div className="card p-8 text-center text-slate-500">
              No Equbs yet.<br />Create your first separate ledger.
            </div>
          )}
          {ids.map(id => {
            const eq = equbs[id]
            const members = eq.members || []
            const cycle = eq.currentCycle || 1
            const paid = members.filter(m => getMemberCycleStatus(m, cycle) === 'paid').length
            const pots = members.filter(m => m.wonCycle).length
            return (
              <div key={id} className="card p-4 cursor-pointer active:scale-[0.98] transition" onClick={() => openEqub(id)}>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                    style={{ background: 'linear-gradient(135deg,#0f766e,#14b8a6)' }}>
                    {eq.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-bold text-lg">{eq.name}</h3>
                        <p className="text-sm text-slate-500">{eq.cycleType} • {eq.amount} ETB</p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700">
                        Cycle {cycle}/{members.length || eq.totalMembers}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {paid}/{members.length} paid this cycle • {pots} pots given
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Started: {formatEthDate(eq.startDate)} · Ends: {formatEthDate(eq.finishDate)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="px-4 mt-6">
          <button className="btn-primary w-full py-4" onClick={() => setScreen('create')}>
            + Create New Equb
          </button>
        </div>
      </div>
    )
  }

  function renderEqubHome() {
    if (!currentEqub) return null
    const members = currentEqub.members || []
    const cycle = currentEqub.currentCycle || 1
    return (
      <div className="pb-24">
        <div className="header">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setScreen('selector')} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              ←
            </button>
            <div className="flex-1 bg-white/15 rounded-xl px-3 py-2">
              <p className="font-bold text-sm truncate">{currentEqub.name}</p>
              <p className="text-xs text-white/80">{currentEqub.cycleType} • {currentEqub.amount} ETB</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/20 rounded-xl p-2 text-center">
              <p className="text-lg font-bold">{cycle}/{members.length || currentEqub.totalMembers}</p>
              <p className="text-xs text-white/80">Current Cycle</p>
            </div>
            <div className="bg-white/20 rounded-xl p-2 text-center">
              <p className="text-lg font-bold">{members.filter(m => m.wonCycle).length}</p>
              <p className="text-xs text-white/80">Pots Given</p>
            </div>
            <div className="bg-white/20 rounded-xl p-2 text-center">
              <p className="text-lg font-bold">{paidThisCycle}/{members.length}</p>
              <p className="text-xs text-white/80">Paid this cycle</p>
            </div>
          </div>
        </div>
        <div className="px-4 pt-4 space-y-4">
          <div className="card p-3 text-sm text-slate-500">
            Start: {formatEthDate(currentEqub.startDate)} · Finish: {formatEthDate(currentEqub.finishDate)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="card p-4 flex flex-col items-center gap-2" onClick={openLottery}>
              <span className="text-2xl">🎲</span>
              <span className="font-semibold text-sm">Draw Winner</span>
            </button>
            <button className="card p-4 flex flex-col items-center gap-2" onClick={() => setScreen('calendar')}>
              <span className="text-2xl">📅</span>
              <span className="font-semibold text-sm">Calendar</span>
            </button>
          </div>
          <div className="card p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Cycle {cycle} Payments</h3>
              <button className="text-sm font-semibold text-teal-700" onClick={() => {
                const unpaid = members.filter(m => getMemberCycleStatus(m, cycle) !== 'paid')
                if (unpaid[0]) openSms(unpaid[0])
                else showMsg('Everyone paid this cycle!')
              }}>Remind Unpaid</button>
            </div>
            <div className="space-y-1">
              {members.slice(0, 6).map(m => {
                const st = getMemberCycleStatus(m, cycle)
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0"
                    onClick={() => { setCurrentMemberId(m.id); setScreen('member-detail') }}>
                    <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center text-sm font-bold">
                      {initials(m.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{m.name}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      st === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                      st === 'late' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                    }`}>{st}</span>
                    <button className={`tick-btn ${st === 'paid' ? 'paid' : ''}`}
                      onClick={(e) => { e.stopPropagation(); togglePaid(m.id) }}>
                      {st === 'paid' ? '✓' : ''}
                    </button>
                  </div>
                )
              })}
            </div>
            <button className="w-full mt-3 py-2.5 text-sm font-semibold text-teal-700" onClick={() => setScreen('members')}>
              View All Members →
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderMembers() {
    if (!currentEqub) return null
    const members = currentEqub.members || []
    const cycle = currentEqub.currentCycle || 1
    return (
      <div className="pb-24">
        <div className="header">
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('equb-home')} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">←</button>
            <div>
              <h1 className="text-lg font-bold">Members</h1>
              <p className="text-xs text-white/80">{currentEqub.name} • {members.length} members</p>
            </div>
          </div>
        </div>
        <div className="px-4 pt-3">
          <div className="card overflow-hidden">
            {members.map(m => {
              const st = getMemberCycleStatus(m, cycle)
              return (
                <div key={m.id} className="flex items-center p-4 border-b border-slate-100 last:border-0"
                  onClick={() => { setCurrentMemberId(m.id); setScreen('member-detail') }}>
                  <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 ml-3 min-w-0">
                    <p className="font-semibold truncate">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.phone} · Cycle {cycle}: {st}</p>
                  </div>
                  <button className={`tick-btn ${st === 'paid' ? 'paid' : ''}`}
                    onClick={(e) => { e.stopPropagation(); togglePaid(m.id) }}>
                    {st === 'paid' ? '✓' : ''}
                  </button>
                </div>
              )
            })}
          </div>
          <button className="btn-primary w-full mt-4 py-3.5" onClick={() => setAddMemberOpen(true)}>
            + Add Member
          </button>
        </div>
      </div>
    )
  }

  function renderMemberDetail() {
    if (!currentMember || !currentEqub) return null
    const payments = currentMember.payments || {}
    const paidCycles = Object.values(payments).filter(p => p.status === 'paid').length
    const lateCycles = Object.values(payments).filter(p => p.status === 'late').length
    const maxCycle = Math.max(currentEqub.currentCycle || 1, ...Object.keys(payments).map(Number), 1)

    return (
      <div className="pb-24">
        <div className="header" style={{ paddingBottom: 30 }}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setScreen('members')} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">←</button>
            <h1 className="text-lg font-bold">Member Details</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
              {initials(currentMember.name)}
            </div>
            <div>
              <h2 className="text-xl font-bold">{currentMember.name}</h2>
              <p className="text-white/80">{currentMember.phone}</p>
              <div className="flex gap-2 mt-2">
                <button className="bg-white/20 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  onClick={() => window.open(`tel:${currentMember.phone}`, '_self')}>📞 Call</button>
                <button className="bg-white/20 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  onClick={() => openSms(currentMember)}>💬 SMS</button>
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 -mt-4 space-y-4">
          <div className="card p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold">{paidCycles}</p>
              <p className="text-xs text-slate-500">Cycles Paid</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-600">{lateCycles}</p>
              <p className="text-xs text-slate-500">Late</p>
            </div>
            <div>
              <p className="text-xl font-bold text-teal-700">
                {currentMember.wonCycle ? `Yes (${currentMember.wonCycle})` : 'No'}
              </p>
              <p className="text-xs text-slate-500">Won Pot?</p>
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-bold">Payment by Cycle</h3>
            </div>
            {Array.from({ length: maxCycle }, (_, i) => i + 1).map(c => {
              const p = payments[c]
              const st = p?.status || 'pending'
              return (
                <div key={c} className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="font-medium">Cycle {c}</p>
                    <p className="text-xs text-slate-500">{p?.date || '—'}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    st === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                    st === 'late' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                  }`}>{st}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  function renderCalendar() {
    if (!currentEqub) return null
    const daysInMonth = calMonth === 12 ? 5 : 30
    const today = getEthiopianToday()
    const cols = currentEqub.collections || []

    return (
      <div className="pb-24">
        <div className="header">
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('equb-home')} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">←</button>
            <div>
              <h1 className="text-lg font-bold">Calendar</h1>
              <p className="text-xs text-white/80">{currentEqub.name} only</p>
            </div>
          </div>
        </div>
        <div className="px-4 pt-4 space-y-4">
          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <button className="w-9 h-9 rounded-full bg-slate-100" onClick={() => {
                let m = calMonth - 1, y = calYear
                if (m < 0) { m = 12; y-- }
                setCalMonth(m); setCalYear(y)
              }}>‹</button>
              <h3 className="font-bold text-lg">{ethMonths[calMonth]} {calYear}</h3>
              <button className="w-9 h-9 rounded-full bg-slate-100" onClick={() => {
                let m = calMonth + 1, y = calYear
                if (m > 12) { m = 0; y++ }
                setCalMonth(m); setCalYear(y)
              }}>›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-slate-500">
              {['እሁድ','ሰኞ','ማክሰ','ረቡዕ','ሐሙስ','አርብ','ቅዳሜ'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={'o'+i} className="aspect-square flex items-center justify-center text-slate-300 text-sm">{26+i}</div>
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1
                const isToday = calMonth === today.monthIndex && d === today.day && calYear === today.year
                return (
                  <div key={d}
                    className={`aspect-square flex items-center justify-center rounded-xl text-sm font-medium
                      ${isToday ? 'bg-teal-600 text-white font-bold' : ''}`}>
                    {d}
                  </div>
                )
              })}
            </div>
          </div>
          <h3 className="font-bold">Collection History (this Equb)</h3>
          {cols.length === 0 ? (
            <div className="card p-6 text-center text-slate-500">No collections recorded yet for this Equb</div>
          ) : (
            cols.map((c, idx) => (
              <div key={idx} className="card p-4">
                <div className="flex justify-between mb-2">
                  <div>
                    <p className="font-bold">Cycle {c.cycle}</p>
                    <p className="text-sm text-slate-500">{c.date}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    c.paid === c.total ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>{c.paid}/{c.total} paid</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Collected: <b className="text-slate-800">{(c.collected || 0).toLocaleString()} ETB</b></span>
                  <span>Winner: <b className="text-teal-700">{c.winner || '—'}</b></span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  function renderCreate() {
    const today = getEthiopianToday()
    return (
      <div className="pb-8">
        <div className="header">
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('selector')} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">←</button>
            <h1 className="text-lg font-bold">Create New Equb</h1>
          </div>
        </div>
        <div className="px-4 pt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Equb Name</label>
            <input className="w-full px-4 py-3 rounded-xl border border-slate-200" value={newName}
              onChange={e => setNewName(e.target.value)} placeholder="e.g. Merkato Traders" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Contribution Amount (ETB)</label>
            <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200" value={newAmount}
              onChange={e => setNewAmount(e.target.value)} placeholder="500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Number of Members</label>
            <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200" value={newMembers}
              onChange={e => setNewMembers(e.target.value)} placeholder="12" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Cycle Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['daily', 'weekly', 'biweekly', 'monthly'].map(c => (
                <button key={c}
                  className={`py-3 rounded-xl border-2 font-semibold text-sm capitalize ${
                    cycleType === c ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500'
                  }`}
                  onClick={() => setCycleType(c)}>
                  {c === 'biweekly' ? 'Every 2 Weeks' : c}
                </button>
              ))}
            </div>
          </div>
          {cycleType === 'weekly' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Weekly collection day</label>
              <div className="grid grid-cols-2 gap-2">
                {['Saturday', 'Sunday'].map(d => (
                  <button key={d}
                    className={`py-3 rounded-xl border-2 font-semibold text-sm ${
                      cycleDay === d ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500'
                    }`}
                    onClick={() => setCycleDay(d)}>
                    {d === 'Saturday' ? 'ቅዳሜ (Sat)' : 'እሁድ (Sun)'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Start Date (Ethiopian)</label>
            <input className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50" value={today.formatted} readOnly />
            <p className="text-xs mt-1 text-slate-500">Auto-filled with today (Habesha calendar)</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Default Late Fee (ETB)</label>
            <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200" value={newLateFee}
              onChange={e => setNewLateFee(e.target.value)} />
          </div>
          <button className="btn-primary w-full py-4 text-base" onClick={handleCreateEqub}>
            Create Equb
          </button>
        </div>
      </div>
    )
  }

  // ========== MAIN RENDER ==========
  return (
    <div className="min-h-screen pb-20">
      <div className={`toast ${showToast ? 'show' : ''}`}>{toast}</div>

      {screen === 'selector' && renderSelector()}
      {screen === 'equb-home' && renderEqubHome()}
      {screen === 'members' && renderMembers()}
      {screen === 'member-detail' && renderMemberDetail()}
      {screen === 'calendar' && renderCalendar()}
      {screen === 'create' && renderCreate()}

      {/* Bottom Nav */}
      {['equb-home', 'members', 'calendar'].includes(screen) && (
        <div className="bottom-nav">
          <div className={`nav-item ${screen === 'equb-home' ? 'active' : ''}`} onClick={() => setScreen('equb-home')}>
            <span>🏠</span><span>Home</span>
          </div>
          <div className={`nav-item ${screen === 'members' ? 'active' : ''}`} onClick={() => setScreen('members')}>
            <span>👥</span><span>Members</span>
          </div>
          <div className={`nav-item ${screen === 'calendar' ? 'active' : ''}`} onClick={() => setScreen('calendar')}>
            <span>📅</span><span>Calendar</span>
          </div>
          <div className="nav-item" onClick={() => setScreen('selector')}>
            <span>☰</span><span>Equbs</span>
          </div>
        </div>
      )}

      {/* Lottery Modal */}
      {lotteryOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setLotteryOpen(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-[480px] p-5" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-5" />
            <h2 className="text-xl font-bold text-center mb-1">Select Winner – Cycle {currentEqub?.currentCycle}</h2>
            <p className="text-center text-sm text-slate-500 mb-5">Only members who have not received the pot</p>
            <button className="w-full py-4 rounded-2xl text-white font-bold text-lg mb-4"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}
              onClick={runLottery}>
              🎲 Randomize
            </button>
            <div className="max-h-40 overflow-y-auto space-y-1 mb-4">
              {(currentEqub?.members || []).filter(m => !m.wonCycle).map(m => (
                <button key={m.id} className="w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3"
                  onClick={() => selectWinnerManually(m)}>
                  <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center text-sm font-bold">
                    {initials(m.name)}
                  </div>
                  {m.name}
                </button>
              ))}
            </div>
            <button className="w-full py-3 text-slate-500" onClick={() => setLotteryOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Winner Modal */}
      {winnerOpen && selectedWinner && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-[480px] p-5 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>🎉</div>
            <h2 className="text-xl font-bold mb-1">Winner Selected!</h2>
            <p className="text-3xl font-extrabold my-3 text-purple-600">{selectedWinner.name}</p>
            <p className="mb-6 text-slate-500">
              will receive {(currentEqub.amount * (currentEqub.members?.length || 0)).toLocaleString()} ETB
              (Cycle {currentEqub.currentCycle})
            </p>
            <button className="btn-primary w-full py-3.5" onClick={confirmWinner}>Confirm & Record</button>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {addMemberOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setAddMemberOpen(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-[480px] p-5" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-center mb-4">Add Member</h2>
            <div className="space-y-3">
              <input className="w-full px-4 py-3 rounded-xl border border-slate-200" placeholder="Full Name"
                value={addName} onChange={e => setAddName(e.target.value)} />
              <input className="w-full px-4 py-3 rounded-xl border border-slate-200" placeholder="Phone Number"
                value={addPhone} onChange={e => setAddPhone(e.target.value)} />
            </div>
            <button className="btn-primary w-full mt-4 py-3" onClick={handleAddMember}>Add Member</button>
            <button className="w-full py-3 mt-2 text-slate-500" onClick={() => setAddMemberOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {smsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setSmsOpen(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-[480px] p-5" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-center mb-4">Send Reminder</h2>
            <div className="bg-slate-50 rounded-2xl p-4 mb-4">
              <p className="text-sm text-slate-500 mb-1">To</p>
              <p className="font-semibold">{smsTo}</p>
              <p className="text-sm text-slate-500 mt-3 mb-1">Message (editable)</p>
              <textarea className="w-full rounded-xl p-3 text-sm border border-slate-200" rows={3}
                value={smsBody} onChange={e => setSmsBody(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-secondary" onClick={() => setSmsOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={sendSms}>Open SMS App</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
