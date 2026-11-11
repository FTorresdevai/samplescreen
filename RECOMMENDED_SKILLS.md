# 🛠️ Guia de Agent Skills Recomendadas para a Equipa

Este documento define o conjunto de **Agent Skills** recomendadas para o nosso fluxo de trabalho de desenvolvimento com assistentes de IA (como Google Antigravity, Claude Code, Cursor e GitHub Copilot).

---

## 🎯 Por que usamos Agent Skills?

As **Agent Skills** utilizam o padrão aberto de *progressive disclosure* baseado em ficheiros `SKILL.md`. Em vez de usar instruções genéricas ou prompts longos que poluem a janela de contexto:
- O agente só carrega as instruções detalhadas quando a tarefa realmente exige.
- Garante que a IA segue padrões rigorosos de engenharia (TDD, testes, revisões de segurança, commits semânticos).
- Unifica a qualidade do código produzido por qualquer elemento da equipa.

---

## 🚀 Como Instalar as Skills

### Opção A: Instalação Global na sua Máquina (Recomendado para todos os projetos)

#### Para Antigravity / Gemini CLI:
As skills globais residem no diretório:
```bash
~/.gemini/config/skills/
```

Para clonar e instalar o conjunto completo de engenharia de software de uma só vez:
```bash
# Criar pasta se não existir
mkdir -p ~/.gemini/config/skills

# Clonar o repositório temporariamente e copiar as skills
git clone --depth 1 https://github.com/addyosmani/agent-skills.git /tmp/addyosmani-agent-skills
cp -r /tmp/addyosmani-agent-skills/skills/* ~/.gemini/config/skills/
rm -rf /tmp/addyosmani-agent-skills
```

#### Para Claude Code / outros agentes via CLI oficial:
```bash
npx skills add addyosmani/agent-skills
```

---

### Opção B: Instalação no Nível do Repositório / Workspace

Para garantir que qualquer pessoa (ou agente) que abra este repositório tenha acesso às mesmas regras e procedimentos, as skills podem ser colocadas na pasta do projeto:
```text
.agents/skills/<nome-da-skill>/SKILL.md
```
Desta forma, ao fazer commit das pastas em `.agents/skills/`, todos os programadores partilham automaticamente as mesmas diretrizes.

---

## 📚 Catálogo de Skills Recomendadas

As skills abaixo foram selecionadas do repositório [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) e [google/skills](https://github.com/google/skills).

### 1. Planeamento e Alinhamento de Requisitos

| Skill | Quando usar | Como pedir ao Agente |
| :--- | :--- | :--- |
| **`interview-me`** | Antes de iniciar uma funcionalidade complexa. O agente faz perguntas de clarificação antes de tocar no código. | *"Usa a skill interview-me para clarificar os requisitos da feature X."* |
| **`spec-driven-development`** | Para escrever uma especificação técnica ou PRD claro antes da implementação. | *"Gera uma especificação técnica antes de começarmos a codificar."* |
| **`planning-and-task-breakdown`** | Para decompor uma tarefa grande em passos incrementais com critérios de verificação. | *"Divide a tarefa em passos atómicos com checklist de validação."* |

---

### 2. Desenvolvimento com Rigor e Sem Alucinações

| Skill | Quando usar | Como pedir ao Agente |
| :--- | :--- | :--- |
| **`test-driven-development`** | Obrigatório para novas regras de negócio e lógicas sensíveis. Segue o ciclo Red-Green-Refactor. | *"Implementa esta funcionalidade seguindo Test-Driven Development (TDD)."* |
| **`incremental-implementation`** | Para evitar alterações maciças ou reescritas de centenas de linhas de uma só vez. | *"Faz a implementação em pequenos incrementos testáveis."* |
| **`doubt-driven-development`** | Obriga o agente a parar e verificar a realidade do código e ficheiros em vez de tentar adivinhar soluções. | *"Valida as tuas hipóteses diretamente no código antes de sugerir mudanças."* |
| **`debugging-and-error-recovery`** | Diagnóstico sistemático de erros (isolamento de causa raiz e teste de regressão). | *"Depura este erro procurando a causa raiz e cria um teste de regressão."* |

---

### 3. Qualidade, Revisão e Segurança

| Skill | Quando usar | Como pedir ao Agente |
| :--- | :--- | :--- |
| **`code-review-and-quality`** | Antes de abrir ou aprovar qualquer Pull Request. Avalia 5 eixos: correção, legibilidade, arquitetura, segurança e performance. | *"Faz um code review rigoroso das alterações deste PR / diff."* |
| **`code-simplification`** | Refatoração de código com complexidade acidental, aninhamentos excessivos ou abstrações prematuras. | *"Simplifica este módulo mantendo o comportamento e a cobertura de testes."* |
| **`security-and-hardening`** | Auditoria e proteção contra vulnerabilidades (injeção, XSS, exposição de segredos, validação de inputs). | *"Audita este código à procura de riscos de segurança e aplica boas práticas."* |

---

### 4. Frontend, Performance e UI

| Skill | Quando usar | Como pedir ao Agente |
| :--- | :--- | :--- |
| **`frontend-ui-engineering`** | Construção de componentes modernos, acessibilidade (WCAG), responsividade e estado da UI. | *"Desenvolve o componente seguindo boas práticas de frontend e acessibilidade."* |
| **`performance-optimization`** | Otimização de bundle, Core Web Vitals, re-renderizações desnecessárias e lazy loading. | *"Analisa a performance e sugere melhorias com base em métricas."* |
| **`browser-testing-with-devtools`** | Testes no browser usando Chrome DevTools para inspecionar erros de consola, rede e layout. | *"Valida a interface no browser e verifica se há erros na consola ou rede."* |

---

### 5. Git e Gestão de Versões

| Skill | Quando usar | Como pedir ao Agente |
| :--- | :--- | :--- |
| **`git-workflow-and-versioning`** | Criação de commits semânticos (*Conventional Commits*), branch naming e mensagens de PR claras. | *"Prepara os commits semânticos para as alterações realizadas."* |
| **`documentation-and-adrs`** | Registo de decisões arquiteturais importantes (ADRs) e documentação de APIs. | *"Documenta esta decisão de arquitetura num ficheiro ADR."* |

---

## 🔗 Repositórios de Referência

- **[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)**: Repositório com as skills de SDLC e engenharia de software sênior.
- **[google/skills](https://github.com/google/skills)**: Skills oficiais da Google para GCP, BigQuery, Cloud Run, Firebase e boas práticas de arquitetura na nuvem.
- **[VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)**: Catálogo com mais de 1.000 skills da comunidade organizadas por tecnologia.
- **[anthropics/skills](https://github.com/anthropics/skills)**: Padrão aberto de especificação de skills.

---

## 💡 Dica de Ouro para o Dia a Dia

> Antes de pedir ao assistente para "fazer tudo de uma vez", invoque uma skill de planeamento (`planning-and-task-breakdown` ou `interview-me`). Isso reduz o tempo gasto em correções, diminui bugs e garante código alinhado com as expectativas da equipa.
