# Fundação Água Limpa — Plataforma MIPC

Plataforma web para o **Monitoramento Inteligente de Poços Comunitários (MIPC)** do Assentamento Santa Luzia (DF), desenvolvida para a **ONG Fundação Água Limpa**. Conecta telemetria IoT de qualidade da água, manutenção preventiva em campo, emissão de boletins técnicos em PDF com hash SHA-256, ouvidoria comunitária e gestão de emergências em tempo real com persistência no **Supabase**.

- **Aplicação publicada (GitHub Pages):** https://buuninbee.github.io/fundacao-agua/

---

## Perfis e Funcionalidades

A plataforma organiza o acesso em **3 portais** (cobrindo as histórias de usuário `HU-MIPC-01` a `HU-MIPC-13`):

| Portal | Módulos principais | O que permite fazer |
| :--- | :--- | :--- |
| **Fiscal / Agente de Campo (+ IoT & TI)** | Monitoramento IoT, Manutenção e Filtros, Boletins Técnicos, Saúde IoT, Calibração e Hardware, Usuários e Permissões | Mapa georreferenciado de poços (Leaflet), alertas automáticos de pH/turbidez/temperatura e falha de sinal (`> 30 min`), agenda de visitas técnicas, registro de troca de mídia filtrante e calibração, emissão de **Boletins Técnicos em PDF** com filtros/seleção de medições e hash SHA-256, telemetria de bateria/RSSI/firmware e gestão de acessos com log de auditoria. |
| **Morador** | Qualidade da Água, Comunicados, Ouvidoria Comunitária | Tradução simplificada da segurança da água do poço (`Segura`, `Atenção`, `Não consumir`), leitura de alertas operacionais e guias sanitários, confirmação em workshops e abertura de chamados com protocolo (`OUV-AAAA-XXXXX`), fotos e GPS. |
| **Liderança Comunitária** | Indicadores do Território, Reporte de Urgências, Workshops e Capacitações | Consolidação de indicadores por setor, acionamento emergencial com SLA de 2h (interdição imediata do poço, comunicado crítico e visita urgente), organização de oficinas comunitárias com controle de vagas, lista de espera e check-in. |

---

## Stack Tecnológica

- **Frontend:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4
- **UI & Visualização:** Radix UI, Lucide Icons, Leaflet (mapas), Recharts (gráficos), jsPDF (boletins oficiais em PDF)
- **Backend & Banco de Dados:** Supabase (PostgreSQL + Data API REST via `@supabase/supabase-js`)
- **Gerenciador de Pacotes:** `pnpm`
- **CI/CD:** GitHub Actions → GitHub Pages

---

## Estrutura do Projeto

```text
fundacao-agua/
├── README.md
├── GEMINI.md                              # Regras genéricas de orquestração multi-agente
├── .github/
│   └── workflows/
│       └── deploy-pages.yml               # Build e deploy automático no GitHub Pages
├── .agents/
│   ├── skills/                            # Skills reutilizáveis por domínio (orchestrator, frontend, backend, testing, devops)
│   ├── handoffs/TEMPLATE.md               # Modelo de handoff entre agentes
│   └── project/                           # Contexto específico deste projeto (context.md, design.md, hu/*.docx)
└── Frontend/
    ├── .env.example                       # Modelo das variáveis do Supabase
    ├── package.json
    ├── vite.config.ts
    ├── scripts/
    │   ├── check-water-rules.ts           # Verificação automatizada das regras sanitárias e de negócio
    │   └── check-supabase-api.mjs         # Smoke test de leitura/escrita na API do Supabase
    └── src/
        ├── App.tsx                        # Definição das rotas por perfil
        ├── main.tsx                       # Entrypoint React + HashRouter
        ├── components/                    # Componentes reutilizáveis e WellsMap (Leaflet)
        ├── context/MipcStore.tsx          # Estado global sincronizado com o Supabase (sem localStorage)
        ├── layouts/                       # FiscalLayout, MoradorLayout e LiderancaLayout
        ├── lib/
        │   ├── supabase.ts                # Cliente @supabase/supabase-js
        │   ├── mipcApi.ts                 # Mapeamento e CRUD das 14 tabelas no Supabase
        │   ├── waterRules.ts              # Regras sanitárias, estatísticas, protocolos e SHA-256
        │   └── bulletinPdf.ts             # Geração do Boletim Técnico em PDF
        ├── pages/                         # Telas organizadas em fiscal/, morador/, lideranca/ e LoginPage
        └── types/mipc.ts                  # Tipagens TypeScript do domínio
```

---

## Banco de Dados (Supabase)

O frontend consome diretamente a API REST do Supabase (sem `localStorage`) sobre **14 tabelas** no schema `public`:

- **Telemetria e Unidades:** `pocos`, `leituras_iot`, `dispositivos_iot`, `calibracoes`, `trocas_hardware`
- **Operação e Documentos:** `visitas_tecnicas`, `manutencoes`, `boletins_tecnicos`
- **Comunidade e Comunicação:** `comunicados`, `ouvidoria_chamados`, `emergencias`, `workshops`
- **Acessos e Auditoria:** `usuarios`, `auditoria_logs`

> **Nota de segurança (modo protótipo):** todas as tabelas estão com RLS habilitado usando políticas abertas (`demo_full_access`) para demonstração por persona sem login real. Antes de uso em produção real, habilite **Supabase Auth** e substitua as políticas RLS por regras baseadas em `auth.uid()` e papéis em `app_metadata`.

---

## Como Rodar Localmente

### Pré-requisitos
- Node.js 22+
- `pnpm` 10+

### Passo a passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/buuninbee/fundacao-agua.git
   cd fundacao-agua
   ```

2. **Configure as variáveis do Supabase:**
   ```bash
   cp Frontend/.env.example Frontend/.env.local
   ```
   Edite `Frontend/.env.local` com a URL e a chave publishable (`sb_publishable_...`) do seu projeto Supabase:
   ```env
   VITE_SUPABASE_URL=https://<seu-project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<sua-chave>
   ```

3. **Instale as dependências e inicie o servidor:**
   ```bash
   pnpm --dir Frontend install
   pnpm --dir Frontend dev
   ```
   Acesse `http://localhost:5173/`.

### Scripts úteis

| Comando | Descrição |
| :--- | :--- |
| `pnpm --dir Frontend dev` | Inicia o servidor de desenvolvimento Vite |
| `pnpm --dir Frontend build` | Executa checagem TypeScript (`tsc -b`) e gera o bundle em `Frontend/dist/` |
| `pnpm --dir Frontend lint` | Executa o ESLint em todo o frontend |
| `node --experimental-strip-types Frontend/scripts/check-water-rules.ts` | Valida regras sanitárias, protocolos, RSVP e validações (`HU-01` a `HU-13`) |
| `node Frontend/scripts/check-supabase-api.mjs` | Valida leitura das 14 tabelas e escrita/remoção na API do Supabase |

---

## Deploy Automático (GitHub Pages)

O workflow [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) compila e publica `Frontend/dist/` automaticamente a cada push na branch `main`.

Variáveis necessárias em **Settings → Secrets and variables → Actions → Variables**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Sistema de Design

As diretrizes visuais oficiais estão documentadas em [.agents/project/design.md](.agents/project/design.md):
- **Paleta:** Azul institucional (`#001325` / `#002d58`), Laranja CTA (`#fea842` com texto `#001325`, contraste WCAG AAA) e Neutros claros (`#fdfeff` / `#f8fbfd`).
- **Tipografia:** `Inria Serif` para cabeçalhos e destaques; `Instrument Sans` para corpo, tabelas e controles.
