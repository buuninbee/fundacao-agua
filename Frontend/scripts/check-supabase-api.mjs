import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx), line.slice(idx + 1)]
    }),
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const tables = [
  'pocos',
  'leituras_iot',
  'usuarios',
  'visitas_tecnicas',
  'manutencoes',
  'boletins_tecnicos',
  'comunicados',
  'ouvidoria_chamados',
  'emergencias',
  'workshops',
  'dispositivos_iot',
  'calibracoes',
  'trocas_hardware',
  'auditoria_logs',
]

const counts = {}
for (const table of tables) {
  const { data, error } = await supabase.from(table).select('*')
  assert.equal(error, null, `SELECT ${table} failed: ${error?.message}`)
  counts[table] = data.length
}

assert.ok(counts.pocos >= 7, `Expected >= 7 pocos, got ${counts.pocos}`)
assert.ok(counts.leituras_iot >= 14, `Expected >= 14 leituras_iot, got ${counts.leituras_iot}`)
assert.ok(counts.usuarios >= 4, `Expected >= 4 usuarios, got ${counts.usuarios}`)

// Roundtrip write + read + cleanup on identity-key table (visitas_tecnicas)
const { data: visitRow, error: visitInsErr } = await supabase
  .from('visitas_tecnicas')
  .insert({
    poco_id: 1,
    nome_poco: 'Poço #042',
    motivo_visita: 'Smoke test integração API',
    status: 'Agendada',
  })
  .select('id')
  .single()
assert.equal(visitInsErr, null, `INSERT visitas_tecnicas failed: ${visitInsErr?.message}`)
assert.ok(visitRow?.id, 'Expected generated bigint id from visitas_tecnicas')

const { error: visitDelErr } = await supabase
  .from('visitas_tecnicas')
  .delete()
  .eq('id', visitRow.id)
assert.equal(visitDelErr, null, `DELETE visitas_tecnicas cleanup failed: ${visitDelErr?.message}`)

// Roundtrip write + read + cleanup on UUID table (ouvidoria_chamados)
const testUuid = crypto.randomUUID()
const { error: tickInsErr } = await supabase.from('ouvidoria_chamados').insert({
  id: testUuid,
  codigo_protocolo: 'OUV-TEST-00001',
  poco_id: 1,
  nome_poco: 'Poço #042',
  categoria: 'Alteração de Odor',
  descricao: 'Smoke test integração Supabase',
  status: 'Registrado',
})
assert.equal(tickInsErr, null, `INSERT ouvidoria_chamados failed: ${tickInsErr?.message}`)

const { error: tickDelErr } = await supabase
  .from('ouvidoria_chamados')
  .delete()
  .eq('id', testUuid)
assert.equal(tickDelErr, null, `DELETE ouvidoria_chamados cleanup failed: ${tickDelErr?.message}`)

console.log('✓ Supabase API roundtrip OK (publishable key):', JSON.stringify(counts))
