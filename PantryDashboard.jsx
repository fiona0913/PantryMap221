import React from 'react'
import { AlertTriangle, Thermometer, User, Box } from 'lucide-react'
import dashboardData from './dashboard_data.json'

export default function PantryDashboard() {
  const data = dashboardData || {}
  const perf = data.modules?.performance || {}
  const persona = data.modules?.persona || {}
  const highlights = data.modules?.highlights || {}

  const stock = typeof perf.stockLevel === 'number' ? perf.stockLevel : null
  const temp = typeof perf.temperature === 'number' ? perf.temperature : null
  const visits = perf.doorVisits ?? perf.visits ?? perf.visitors ?? null

  const pantryName = persona.pantry?.name || persona.name || 'Pantry'
  const avatar = persona.pantry?.avatar || persona.avatar || null
  const goal = persona.goal ?? persona.target ?? null
  const prefs = persona.preferences || []

  const recent = highlights.recentActivity || []
  const hasAlert = !!highlights.hasAlert

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Module A: Performance (left/top) */}
        <section className="md:col-span-2 bg-white shadow rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Box className="w-5 h-5 text-green-600" />
            Performance
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <div className="text-sm font-medium text-gray-700">Stock Level</div>
                <div className="text-sm font-medium text-gray-900">{stock !== null ? `${stock}%` : '—'}</div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-green-500"
                  style={{ width: stock !== null ? `${Math.max(0, Math.min(100, stock))}%` : '0%' }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Thermometer className="w-5 h-5 text-red-500" />
              <div>
                <div className="text-sm font-medium">Temperature</div>
                <div className={"text-sm " + (temp !== null && temp > 10 ? 'text-red-600 font-semibold' : 'text-gray-700') }>
                  {temp !== null ? `${temp} °C` : '—'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-gray-700">Visits</div>
              <div className="text-sm text-gray-900">{visits !== null ? visits : '—'}</div>
            </div>
          </div>
        </section>

        {/* Module B: Persona (right/top) */}
        <aside className="md:col-span-1 bg-white shadow rounded-lg p-4">
          <div className="flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="w-6 h-6 text-gray-500" />
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500">Pantry</div>
              <div className="text-lg font-semibold">{pantryName}</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <div className="text-sm font-medium text-gray-700">Goal</div>
              <div className="text-sm font-medium text-gray-900">{goal !== null ? `${goal}%` : '—'}</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-blue-500"
                style={{ width: goal !== null ? `${Math.max(0, Math.min(100, goal))}%` : '0%' }}
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Preferences</div>
            <div className="flex flex-wrap gap-2">
              {(prefs.length > 0 ? prefs : ['—']).map((p, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* Module C: Highlights (bottom, full width) */}
        <section className="md:col-span-3 bg-white shadow rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">Highlights</h3>

          {hasAlert && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 p-3 rounded mb-4">
              <AlertTriangle className="w-5 h-5" />
              <div className="font-medium">Alert</div>
              <div className="text-sm text-red-700">There is an active alert for this pantry.</div>
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Recent Activity</div>
            {recent.length === 0 ? (
              <div className="text-sm text-gray-500">No recent activity</div>
            ) : (
              <ul className="space-y-3">
                {recent.map((a, idx) => (
                  <li key={idx} className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium">{a.action || 'Activity'}</div>
                      {a.details && <div className="text-xs text-gray-500">{a.details}</div>}
                    </div>
                    <div className="text-xs text-gray-400">{a.time || ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
import React from 'react'

const DASHBOARD_DATA = {
  "modules": {
    "performance": {
      "stockLevel": 25.8,
      "temperature": 10.7,
      *** End Patch
                    <div className="text-sm font-medium">{a.action}</div>
                    <div className="text-xs text-gray-500">{a.details}</div>
                  </div>
                  <div className="text-xs text-gray-400">{a.time}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
