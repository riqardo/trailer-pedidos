# 🌭 Trailer do Bigode — Sistema de Pedidos

Aplicação web e API REST para o atendente de um trailer de cachorro-quente registrar,
acompanhar e finalizar os pedidos dos clientes.

O projeto entrega as quatro funcionalidades essenciais do trailer — **login, consulta ao
cardápio, registro de pedidos e finalização de pedidos** — com uma interface pensada para
uso rápido no balcão e uma API documentada em OpenAPI/Swagger.

## Índice

- [Início rápido](#início-rápido)
- [O que é esta aplicação?](#o-que-é-esta-aplicação)
- [Como instalar](#como-instalar)
- [Como executar](#como-executar)
- [Como usar a aplicação](#como-usar-a-aplicação)
- [URLs importantes](#urls-importantes)
- [Dados de teste](#dados-de-teste)
- [Regras de negócio](#regras-de-negócio)
- [Endpoints da API](#endpoints-da-api)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Solução de problemas](#solução-de-problemas)
- [Observações](#observações)

---

## Início rápido

Pré-requisito: **Node.js 20.19 ou superior** e npm instalados.

```bash
git clone https://github.com/riqardo/trailer-pedidos.git
cd trailer-pedidos
npm install
npm start
```

Depois:

1. Abra **http://localhost:3000**.
2. Clique em uma das contas de demonstração (`ana` / `ana123`).
3. Use **Novo pedido** para registrar uma comanda e **Finalizar e receber** para fechar a conta.
4. Consulte a API em **http://localhost:3000/docs**.

> ⏳ Na primeira execução, o `mongodb-memory-server` baixa o binário do MongoDB e isso pode
> demorar alguns minutos. As execuções seguintes usam o cache local.
>
> 🔄 O banco é em memória: **reiniciar o servidor restaura os dados de teste**.

---

## O que é esta aplicação?

Um PDV (ponto de venda) simples para o trailer:

- O atendente entra com usuário e senha.
- Consulta o cardápio com preços e disponibilidade.
- Registra pedidos informando **nome do cliente** e **local** (mesa, placa ou balcão).
- Em pedidos na placa, registra também **modelo/marca/cor do veículo** para facilitar a entrega.
- Personaliza cada item com **observações** (ex.: sem cebola) e **adicionais pagos**
  (extra salsicha, extra cheddar, extra bacon, ovo frito).
- Adiciona, altera a quantidade e remove itens enquanto o pedido está aberto.
- Consulta os pedidos registrados por status, nome, local, veículo ou número.
- Finaliza o pedido escolhendo **dinheiro, Pix ou cartão**, com cálculo automático do total
  (e 10% de desconto para dinheiro).
- Depois de finalizado, o pedido vira somente leitura, com recibo e histórico.

Toda consulta ou alteração de pedido é registrada com o atendente responsável.

### Tecnologias

| Camada        | Tecnologia                                                        |
| ------------- | ----------------------------------------------------------------- |
| Backend       | Node.js + Express 5                                               |
| Banco         | MongoDB em memória com `mongodb-memory-server` + Mongoose          |
| Autenticação  | JWT (`jsonwebtoken`) + senhas com hash `bcryptjs`                 |
| Documentação  | OpenAPI 3.0 em YAML + Swagger UI (`swagger-ui-express`)            |
| Frontend      | HTML, CSS e JavaScript puro (sem etapa de build), servido pelo Express |

> Não há integração real com meios de pagamento. O pagamento é **simulado** e serve apenas
> para registrar a forma escolhida e liberar a finalização do pedido.

---

## Como instalar

Pré-requisitos:

- **Node.js 20.19 ou superior** (o projeto foi validado com Node 24);
- **npm**;
- Acesso à internet no **primeiro uso**, para o `mongodb-memory-server` baixar o binário do
  MongoDB. Depois disso, o binário fica em cache no computador.

```bash
# 1. Entre na pasta do projeto
cd trailer-pedidos

# 2. Instale as dependências
npm install

# 3. (Opcional) Crie seu arquivo de ambiente
cp .env.example .env
# No Windows PowerShell:
# Copy-Item .env.example .env
```

O arquivo `.env` é opcional. Sem ele, os valores padrão são usados. Variáveis disponíveis:

| Variável         | Padrão                        | Descrição                              |
| ---------------- | ----------------------------- | -------------------------------------- |
| `PORT`           | `3000`                        | Porta HTTP da aplicação                |
| `JWT_SECRET`     | `trailer-do-bigode-dev-secret`| Segredo para assinatura dos tokens JWT |
| `JWT_EXPIRES_IN` | `12h`                         | Validade do token de acesso            |
| `DB_NAME`        | `trailer_do_bigode`           | Nome do banco criado em memória        |

---

## Como executar

```bash
npm start
```

Para desenvolvimento com reinício automático ao salvar arquivos:

```bash
npm run dev
```

> 💡 **Windows/PowerShell:** se o PowerShell bloquear o `npm.ps1` por política de execução,
> use `npm.cmd start` / `npm.cmd run dev` ou ajuste a política com
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Ao iniciar, o servidor:

1. sobe uma instância **em memória** do MongoDB;
2. cria o banco, os índices e os dados de teste;
3. disponibiliza a aplicação web, a API e o Swagger.

Saída esperada:

```text
[banco] MongoDB em memoria iniciado e conectado.
[seed] 3 usuários criados.
[seed] 10 produtos criados (1 indisponível).
[seed] 2 pedidos de demonstração criados.

  Trailer do Bigode — Pedidos
  Aplicação:  http://localhost:3000
  Swagger:    http://localhost:3000/docs
  OpenAPI:    http://localhost:3000/api/openapi.yaml
```

> ⚠️ Como o banco é em memória, **os dados voltam ao estado inicial a cada reinício**.
> Isso é intencional e não requer instalação de MongoDB.

Para **encerrar**, pressione `Ctrl+C` no terminal. Ao parar, o MongoDB em memória é desligado
e todos os pedidos criados durante o uso são descartados. Para começar do zero, basta parar e
executar `npm start` novamente.

---

## URLs importantes

| URL                              | Descrição                                             |
| -------------------------------- | ----------------------------------------------------- |
| `http://localhost:3000`          | Aplicação web (login do atendente)                    |
| `http://localhost:3000/docs`     | Documentação interativa da API (Swagger UI)           |
| `http://localhost:3000/api/docs` | Redireciona para a documentação Swagger em `/docs/` |
| `http://localhost:3000/api/openapi.yaml` | Especificação OpenAPI 3.0 em YAML             |
| `http://localhost:3000/api/health` | Verificação de disponibilidade da API               |
| `http://localhost:3000/api/auth/login` | Login (POST)                                    |
| `http://localhost:3000/api/products` | Consulta ao cardápio (GET, autenticado)          |
| `http://localhost:3000/api/addons` | Consulta aos adicionais disponíveis (GET, autenticado) |
| `http://localhost:3000/api/orders` | Listagem e registro de pedidos (GET/POST)            |

---

## Dados de teste

O banco em memória é populado automaticamente na inicialização.

### Usuários

| Nome         | Usuário  | Senha      | Perfil     |
| ------------ | -------- | ---------- | ---------- |
| Ana Souza    | `ana`    | `ana123`   | Atendente  |
| Bruno Lima   | `bruno`  | `bruno123` | Atendente  |
| Carla Mendes | `carla`  | `carla123` | Gerente    |

Na tela de login, os três usuários aparecem como atalhos: basta clicar para entrar.

### Produtos (cardápio)

| #  | Produto                  | Categoria | Preço   | Disponível |
| -- | ------------------------ | --------- | ------- | ---------- |
| 1  | Hot Dog Clássico         | Lanche    | R$ 14,90 | ✅         |
| 2  | Hot Dog Completo         | Lanche    | R$ 19,90 | ✅         |
| 3  | Hot Dog Cheddar Bacon    | Lanche    | R$ 24,90 | ✅         |
| 4  | Hot Dog Mexicano         | Lanche    | R$ 26,90 | ✅         |
| 5  | Hot Dog Vegano           | Lanche    | R$ 22,90 | ✅         |
| 6  | Batata Frita Especial    | Lanche    | R$ 16,90 | ✅         |
| 7  | Combo Casal              | Lanche    | R$ 44,90 | ✅         |
| 8  | Refrigerante Lata 350ml  | Bebida    | R$ 6,00  | ✅         |
| 9  | Suco de Laranja 300ml    | Bebida    | R$ 8,00  | ✅         |
| 10 | Água Mineral 500ml       | Bebida    | R$ 4,00  | ❌         |

> A **Água Mineral** está intencionalmente indisponível para demonstrar a regra de que
> produtos indisponíveis não podem ser adicionados (nem pelo cardápio, nem pela API).

### Adicionais disponíveis

Os adicionais podem ser incluídos em qualquer item da categoria **lanche**, com cobrança por
unidade. Observações como "sem cebola" são livres e não alteram o preço.

| Código           | Adicional        | Preço por unidade |
| ---------------- | ---------------- | ----------------- |
| `extra_salsicha` | Extra salsicha   | R$ 4,00           |
| `extra_cheddar`  | Extra cheddar    | R$ 3,50           |
| `extra_bacon`    | Extra bacon      | R$ 4,50           |
| `ovo_frito`      | Ovo frito        | R$ 2,50           |

### Pedidos de demonstração

| Pedido   | Cliente       | Local       | Itens                                              | Status      | Total    |
| -------- | ------------- | ----------- | -------------------------------------------------- | ----------- | -------- |
| `#0001`  | Seu Joaquim   | Mesa 4      | 2× Hot Dog Completo (sem cebola), 1× Refrigerante  | Em aberto   | R$ 45,80 |
| `#0002`  | Marina Alves  | Placa ABC-1D23 · Fiat Uno prata | 1× Cheddar Bacon, 1× Batata Frita, 1× Suco | Finalizado em dinheiro | R$ 44,82 |

O pedido `#0001` demonstra uma observação por item. O pedido `#0002` demonstra o desconto de
10%: subtotal de R$ 49,80 → **R$ 44,82**. O valor dos adicionais entra no subtotal e,
consequentemente, no cálculo do desconto.

---

## Regras de negócio

| # | Regra                                                                 | Como é aplicada                                                                 |
| - | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1 | Produtos indisponíveis não podem ser adicionados aos pedidos.         | Validado no backend ao criar/alterar pedidos e ao adicionar itens (`409 PRODUCT_UNAVAILABLE`). No frontend, o produto aparece desabilitado. |
| 2 | Pagamentos em dinheiro recebem 10% de desconto sobre o valor total.    | Calculado no backend no momento da finalização (`discount` e `total`). O frontend apenas exibe a prévia do mesmo cálculo. |
| 3 | Um pedido só pode ser finalizado se possuir pelo menos um produto.    | A finalização retorna `422 VALIDATION_ERROR` para pedido vazio. A interface não permite salvar comanda vazia. |
| 4 | Pedido só é finalizado após o pagamento.                               | O status só muda para `finalized` dentro do endpoint `/finalize`, que registra o pagamento simulado (`payment.simulated = true`) na mesma operação. Não existe endpoint para finalizar sem pagamento. |
| 5 | Pedidos abertos podem ser alterados; finalizados são somente leitura. | Todas as rotas de alteração verificam `status === "open"` e retornam `409 ORDER_FINALIZED`. A interface esconde as ações de edição em pedidos finalizados. |
| 6 | Todo pedido exige nome do cliente e local (mesa, placa ou balcão).    | Validação de `customerName` (2–80 caracteres) e `location.type` (`mesa`, `placa`, `balcao`). Mesa exige o número; **placa exige a identificação e o modelo/marca/cor do veículo**; balcão é normalizado para `"Balcão"`. |
| 7 | Toda consulta ou alteração de pedido registra o atendente.            | Todas as rotas de pedidos exigem JWT. Consultas individuais e listagens gravam em `AuditLog` e no `history` do pedido; criação, edição, itens e finalização também registram o atendente. O histórico pode ser visto no detalhe do pedido. |

Detalhes importantes da implementação:

- **Valores em centavos**: preços e totais são calculados com aritmética de centavos para
  evitar erros de arredondamento de ponto flutuante.
- **Snapshot dos itens**: nome, categoria, preço unitário, observação e adicionais são
  gravados no pedido no momento em que o item é incluído, preservando o histórico mesmo se o
  cardápio ou a tabela de adicionais mudar.
- **Personalização por linha**: a mesma combinação de produto + observação + adicionais é
  agrupada; combinações diferentes geram linhas separadas, cada uma com seu próprio total.
- **Auditoria**: além do histórico visível no pedido, a coleção `AuditLog` registra eventos
  como `orders.listed`, `order.viewed`, `order.updated`, `order.item_added` e
  `order.finalized`, sempre com o atendente autenticado.
- **Pagamento simulado**: nenhuma cobrança real é feita. O campo `simulated: true` deixa isso
  explícito na resposta da API.
- **Persistência volátil**: ao encerrar o processo, o MongoDB em memória é descartado.

---

## Como usar a aplicação

### 1. Login

Acesse `http://localhost:3000` e informe usuário e senha, ou clique em uma das contas de
demonstração. O token JWT é válido por 12 horas; o botão de sair fica no rodapé da barra
lateral. Todas as operações exigem um atendente autenticado.

### 2. Consulta ao cardápio

Clique em **Cardápio** na navegação. A tela mostra todos os produtos, preços e disponibilidade.
Produtos indisponíveis aparecem com o selo **Indisponível** e não podem ser adicionados.
Também é possível filtrar por **Lanches** ou **Bebidas** e pesquisar pelo nome. Ao clicar em
**Adicionar**, um novo pedido já é aberto com aquele item na comanda.

### 3. Registro de pedido

1. Clique em **Novo pedido**.
2. Informe o **nome do cliente** (obrigatório, 2 a 80 caracteres).
3. Escolha o local: **Mesa**, **Placa** ou **Balcão**.
   - Mesa: informe o número (ex.: `4`).
   - Placa: informe a identificação (ex.: `ABC-1D23`) **e o modelo/marca/cor do veículo**
     (ex.: `Fiat Uno prata`). Os dois campos são obrigatórios.
   - Balcão: usado para quem aguarda em pé; não precisa de identificação.
4. Toque em um produto para abrir a personalização:
   - ajuste a **quantidade**;
   - informe uma **observação** (ex.: `sem cebola`, `sem vinagrete`);
   - inclua **adicionais** pagos, como extra salsicha, extra cheddar, extra bacon ou ovo frito
     (apenas para lanches);
   - confira o **total do item** e clique em **Adicionar à comanda**.
5. Na comanda, use o lápis para editar observação/adicionais de uma linha, `+`/`−` para a
   quantidade e a lixeira para remover.
6. Confira o subtotal e o total e clique em **Registrar pedido**.

Itens com a mesma combinação de produto, observação e adicionais são agrupados. Combinações
diferentes do mesmo produto viram **linhas separadas** na comanda (ex.: um hot dog sem cebola
e outro com extra cheddar).

Um pedido é criado em aberto e recebe um número sequencial (ex.: `#0003`). O atendente
autenticado fica registrado como criador.

### 4. Alteração de pedido

Somente pedidos em aberto podem ser alterados. Abra o pedido, clique em **Editar**, faça as
mudanças e clique em **Salvar alterações**. As ações de edição não aparecem em pedidos
finalizados. Tentativas de alteração pela API retornam `409 ORDER_FINALIZED`.

### 5. Consulta de pedidos

A tela **Pedidos** lista as comandas e permite:

- alternar entre **Abertos**, **Finalizados** e **Todos**;
- buscar por nome do cliente, mesa, placa, veículo ou número do pedido;
- abrir o detalhe de qualquer pedido;
- acompanhar os indicadores de pedidos abertos, finalizados e faturamento do dia.

Toda abertura de pedido (e toda listagem pela API) registra a consulta com o atendente.

### 6. Finalização e pagamento

1. Abra um pedido em aberto.
2. Clique em **Finalizar e receber**.
3. Confira o resumo e escolha **Dinheiro**, **Pix** ou **Cartão**.
4. Em dinheiro, a interface já mostra o desconto de 10% no total.
5. Clique em **Confirmar pagamento**.

O pagamento é **simulado** (não há cobrança real). Após a confirmação, o pedido passa para
**Finalizado**, ganha um recibo com a forma de pagamento, valor pago e atendente responsável,
e fica **somente para consulta**. Pedidos sem itens não podem ser finalizados.

### 7. Histórico e auditoria

No detalhe do pedido, a seção **Histórico de atendimento** mostra os eventos (criação, itens
adicionados/removidos, alterações, consultas e pagamento), sempre com o nome do atendente e o
horário. A API também grava esses eventos na coleção `AuditLog`.

### Fluxo resumido

1. Entrar com `ana` / `ana123`.
2. **Novo pedido** → nome + mesa/placa/balcão (placa exige veículo).
3. Adicionar produtos, definir quantidade, observação e adicionais.
4. **Registrar pedido**.
5. Abrir o pedido → **Finalizar e receber**.
6. Escolher a forma de pagamento e confirmar.
7. Consultar o recibo e o histórico no pedido finalizado.

---

## Endpoints da API

Todas as rotas de pedidos e produtos exigem `Authorization: Bearer <token>`.
A especificação completa, com schemas e exemplos, está em [`docs/openapi.yaml`](docs/openapi.yaml)
e pode ser explorada em `/docs` (o caminho `/api/docs` redireciona para `/docs/`).

### Autenticando na API

1. Faça login em `POST /api/auth/login` com um dos usuários de teste.
2. Copie o valor de `token` retornado.
3. No Swagger (`/docs`), clique em **Authorize**, cole o token e confirme.
4. Em chamadas diretas (curl, Postman etc.), envie o cabeçalho
   `Authorization: Bearer <token>`.

O token expira em **12 horas** (configurável em `JWT_EXPIRES_IN`). Sem token, as rotas
protegidas retornam `401 UNAUTHORIZED`.

| Método | Rota                                      | Descrição                                        |
| ------ | ----------------------------------------- | ------------------------------------------------ |
| `GET`  | `/api/health`                             | Status da API                                    |
| `POST` | `/api/auth/login`                         | Login do atendente e emissão do JWT              |
| `GET`  | `/api/auth/me`                            | Atendente autenticado                            |
| `GET`  | `/api/products`                           | Lista o cardápio (`available`, `category`)       |
| `GET`  | `/api/addons`                             | Lista os adicionais disponíveis e seus preços    |
| `GET`  | `/api/orders`                             | Lista pedidos (`status`, `search`, `locationType`, `page`, `limit`) |
| `POST` | `/api/orders`                             | Registra pedido em aberto (itens com observação e adicionais) |
| `GET`  | `/api/orders/{id}`                        | Detalha pedido e registra a consulta             |
| `PATCH`| `/api/orders/{id}`                        | Altera cliente, local e/ou itens (somente aberto)|
| `POST` | `/api/orders/{id}/items`                  | Adiciona item com observação e adicionais        |
| `PATCH`| `/api/orders/{id}/items/{itemId}`         | Altera quantidade, observação e/ou adicionais    |
| `DELETE`| `/api/orders/{id}/items/{itemId}`        | Remove uma linha do pedido                       |
| `POST` | `/api/orders/{id}/finalize`               | Registra o pagamento e finaliza o pedido         |

### Exemplo rápido com curl

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"ana\",\"password\":\"ana123\"}"

# Consultar cardápio e adicionais (troque <TOKEN> pelo token retornado)
curl http://localhost:3000/api/products \
  -H "Authorization: Bearer <TOKEN>"

curl http://localhost:3000/api/addons \
  -H "Authorization: Bearer <TOKEN>"

# Registrar um pedido em placa, com observação e adicionais
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"customerName\":\"Maria\",\"location\":{\"type\":\"placa\",\"label\":\"ABC-1D23\",\"vehicle\":\"Fiat Uno prata\"},\"items\":[{\"productId\":\"<ID_DO_PRODUTO>\",\"quantity\":2,\"notes\":\"Sem cebola\",\"addons\":[{\"code\":\"extra_cheddar\",\"quantity\":1}]}]}"

# Alterar observação/adicionais de uma linha do pedido
curl -X PATCH http://localhost:3000/api/orders/<ID_DO_PEDIDO>/items/<ID_DO_ITEM> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"notes\":\"Sem cebola e sem vinagrete\",\"addons\":[{\"code\":\"extra_bacon\",\"quantity\":1}]}"

# Finalizar em dinheiro (10% de desconto)
curl -X POST http://localhost:3000/api/orders/<ID_DO_PEDIDO>/finalize \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"paymentMethod\":\"dinheiro\"}"
```

---

## Estrutura do projeto

```text
trailer-pedidos/
├── docs/
│   └── openapi.yaml          # Especificação OpenAPI 3.0
├── public/
│   ├── index.html            # Interface (SPA sem build)
│   ├── favicon.svg
│   ├── css/styles.css        # Estilos
│   └── js/
│       ├── api.js            # Cliente HTTP da API
│       └── app.js            # Lógica da interface
├── src/
│   ├── app.js                # Configuração do Express e Swagger
│   ├── config.js             # Variáveis de ambiente
│   ├── db.js                 # MongoDB em memória
│   ├── data/addons.js        # Catálogo e preços dos adicionais
│   ├── seed.js               # Dados de teste
│   ├── middleware/
│   │   ├── auth.js           # Validação do JWT
│   │   └── error.js          # Tratamento de erros/404
│   ├── models/               # User, Product, Order, AuditLog, Counter
│   ├── routes/               # auth, products, addons, orders
│   ├── services/orders.js    # Regras de negócio e personalização dos pedidos
│   └── utils/                # Dinheiro, erros HTTP e serializadores
├── server.js                 # Bootstrap da aplicação
├── .env.example
├── package.json
└── README.md
```

---

## Solução de problemas

### A porta 3000 já está em uso

Altere a porta no `.env` ou inicie com outra porta:

```bash
# Linux/macOS
PORT=3001 npm start

# Windows PowerShell
$env:PORT=3001; npm.cmd start
```

Depois acesse `http://localhost:3001`.

### O PowerShell bloqueia o comando npm

Se aparecer erro sobre `npm.ps1` por política de execução, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd start
```

Ou ajuste a política para o seu usuário:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### A primeira execução está demorando

O `mongodb-memory-server` baixa o binário do MongoDB na primeira vez que a aplicação sobe.
Isso exige internet e pode levar alguns minutos. Se a rede falhar, execute `npm start`
novamente. Depois do primeiro download, o binário fica em cache e o start é rápido.

### Os pedidos desapareceram

Isso é esperado: o banco é **em memória** e é recriado com os dados de teste a cada reinício.
Para manter os dados, seria necessário trocar a configuração para um MongoDB persistente.

### A API retorna 401

- Confirme se o cabeçalho `Authorization: Bearer <token>` foi enviado.
- O token vale por 12 horas; faça login novamente se tiver expirado.
- No Swagger, clique em **Authorize** e informe um token atualizado.

### Erro de versão do Node.js

O projeto exige **Node.js 20.19 ou superior**. Verifique com:

```bash
node --version
```

### Como saber se a aplicação está no ar

Acesse `http://localhost:3000/api/health`. A resposta esperada é semelhante a:

```json
{ "status": "ok", "service": "trailer-do-bigode-api", "timestamp": "..." }
```

---

## Observações

- **Não há suíte de testes automatizados** neste projeto, por decisão de escopo.
- O frontend não usa framework nem bundler: é servido diretamente pelo Express.
- A documentação Swagger permite autenticar com o botão **Authorize** usando o token do
  login, e assim testar os endpoints protegidos.
- O pagamento é simulado; nenhuma integração financeira real está configurada.
- A aplicação é de uso interno do trailer e não possui controle de permissões por perfil:
  todos os usuários autenticados podem operar pedidos.
