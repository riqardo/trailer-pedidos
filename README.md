# 🌭 Trailer do Bigode — Sistema de Pedidos

Aplicação web e API REST para o atendente de um trailer de cachorro-quente registrar,
acompanhar e finalizar os pedidos dos clientes.

O projeto entrega as quatro funcionalidades essenciais do trailer — **login, consulta ao
cardápio, registro de pedidos e finalização de pedidos** — com uma interface pensada para
uso rápido no balcão e uma API documentada em OpenAPI/Swagger.

---

## O que é esta aplicação?

Um PDV (ponto de venda) simples para o trailer:

- O atendente entra com usuário e senha.
- Consulta o cardápio com preços e disponibilidade.
- Registra pedidos informando **nome do cliente** e **local** (mesa, placa ou balcão).
- Adiciona, altera a quantidade e remove itens enquanto o pedido está aberto.
- Consulta os pedidos registrados por status, nome, local ou número.
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

---

## URLs importantes

| URL                              | Descrição                                             |
| -------------------------------- | ----------------------------------------------------- |
| `http://localhost:3000`          | Aplicação web (login do atendente)                    |
| `http://localhost:3000/docs`     | Documentação interativa da API (Swagger UI)           |
| `http://localhost:3000/api/docs` | Mesmo Swagger UI, em caminho alternativo              |
| `http://localhost:3000/api/openapi.yaml` | Especificação OpenAPI 3.0 em YAML             |
| `http://localhost:3000/api/health` | Verificação de disponibilidade da API               |
| `http://localhost:3000/api/auth/login` | Login (POST)                                    |
| `http://localhost:3000/api/products` | Consulta ao cardápio (GET, autenticado)          |
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

### Pedidos de demonstração

| Pedido   | Cliente       | Local       | Itens                                              | Status      | Total    |
| -------- | ------------- | ----------- | -------------------------------------------------- | ----------- | -------- |
| `#0001`  | Seu Joaquim   | Mesa 4      | 2× Hot Dog Completo, 1× Refrigerante               | Em aberto   | R$ 45,80 |
| `#0002`  | Marina Alves  | Placa ABC-1D23 | 1× Cheddar Bacon, 1× Batata Frita, 1× Suco       | Finalizado em dinheiro | R$ 44,82 |

O pedido `#0002` demonstra o desconto de 10%: subtotal de R$ 49,80 → **R$ 44,82**.

---

## Regras de negócio

| # | Regra                                                                 | Como é aplicada                                                                 |
| - | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1 | Produtos indisponíveis não podem ser adicionados aos pedidos.         | Validado no backend ao criar/alterar pedidos e ao adicionar itens (`409 PRODUCT_UNAVAILABLE`). No frontend, o produto aparece desabilitado. |
| 2 | Pagamentos em dinheiro recebem 10% de desconto sobre o valor total.    | Calculado no backend no momento da finalização (`discount` e `total`). O frontend apenas exibe a prévia do mesmo cálculo. |
| 3 | Um pedido só pode ser finalizado se possuir pelo menos um produto.    | A finalização retorna `422 VALIDATION_ERROR` para pedido vazio. A interface não permite salvar comanda vazia. |
| 4 | Pedido só é finalizado após o pagamento.                               | O status só muda para `finalized` dentro do endpoint `/finalize`, que registra o pagamento simulado (`payment.simulated = true`) na mesma operação. Não existe endpoint para finalizar sem pagamento. |
| 5 | Pedidos abertos podem ser alterados; finalizados são somente leitura. | Todas as rotas de alteração verificam `status === "open"` e retornam `409 ORDER_FINALIZED`. A interface esconde as ações de edição em pedidos finalizados. |
| 6 | Todo pedido exige nome do cliente e local (mesa, placa ou balcão).    | Validação de `customerName` (2–80 caracteres) e `location.type` (`mesa`, `placa`, `balcao`); mesa/placa exigem identificação. Balcão é normalizado para `"Balcão"`. |
| 7 | Toda consulta ou alteração de pedido registra o atendente.            | Todas as rotas de pedidos exigem JWT. Consultas individuais e listagens gravam em `AuditLog` e no `history` do pedido; criação, edição, itens e finalização também registram o atendente. O histórico pode ser visto no detalhe do pedido. |

Detalhes importantes da implementação:

- **Valores em centavos**: preços e totais são calculados com aritmética de centavos para
  evitar erros de arredondamento de ponto flutuante.
- **Snapshot dos itens**: nome, categoria e preço unitário são gravados no pedido no momento
  em que o item é incluído, preservando o histórico mesmo se o cardápio mudar.
- **Auditoria**: além do histórico visível no pedido, a coleção `AuditLog` registra eventos
  como `orders.listed`, `order.viewed`, `order.updated`, `order.item_added` e
  `order.finalized`, sempre com o atendente autenticado.
- **Pagamento simulado**: nenhuma cobrança real é feita. O campo `simulated: true` deixa isso
  explícito na resposta da API.
- **Persistência volátil**: ao encerrar o processo, o MongoDB em memória é descartado.

---

## Fluxo rápido de uso

1. Acesse `http://localhost:3000` e entre com `ana` / `ana123` (ou clique no atalho).
2. Clique em **Novo pedido**.
3. Informe o nome do cliente e escolha **Mesa**, **Placa** ou **Balcão**.
4. Clique nos produtos para adicionar à comanda; ajuste quantidades com `−` e `+`.
5. Clique em **Registrar pedido**.
6. No detalhe do pedido, clique em **Finalizar e receber**.
7. Escolha a forma de pagamento e confirme. Em dinheiro, o desconto de 10% aparece
   automaticamente.
8. O pedido finalizado fica disponível apenas para consulta, com recibo e histórico de quem
   atendeu.

---

## Endpoints da API

Todas as rotas de pedidos e produtos exigem `Authorization: Bearer <token>`.
A especificação completa, com schemas e exemplos, está em [`docs/openapi.yaml`](docs/openapi.yaml)
e pode ser explorada em `/docs`.

| Método | Rota                                      | Descrição                                        |
| ------ | ----------------------------------------- | ------------------------------------------------ |
| `GET`  | `/api/health`                             | Status da API                                    |
| `POST` | `/api/auth/login`                         | Login do atendente e emissão do JWT              |
| `GET`  | `/api/auth/me`                            | Atendente autenticado                            |
| `GET`  | `/api/products`                           | Lista o cardápio (`available`, `category`)       |
| `GET`  | `/api/orders`                             | Lista pedidos (`status`, `search`, `locationType`, `page`, `limit`) |
| `POST` | `/api/orders`                             | Registra pedido em aberto                        |
| `GET`  | `/api/orders/{id}`                        | Detalha pedido e registra a consulta             |
| `PATCH`| `/api/orders/{id}`                        | Altera cliente, local e/ou itens (somente aberto)|
| `POST` | `/api/orders/{id}/items`                  | Adiciona item ao pedido                          |
| `PATCH`| `/api/orders/{id}/items/{productId}`      | Altera a quantidade de um item                   |
| `DELETE`| `/api/orders/{id}/items/{productId}`     | Remove um item do pedido                         |
| `POST` | `/api/orders/{id}/finalize`               | Registra o pagamento e finaliza o pedido         |

### Exemplo rápido com curl

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"ana\",\"password\":\"ana123\"}"

# Consultar cardápio (troque <TOKEN> pelo token retornado)
curl http://localhost:3000/api/products \
  -H "Authorization: Bearer <TOKEN>"

# Registrar um pedido
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"customerName\":\"Maria\",\"location\":{\"type\":\"mesa\",\"label\":\"7\"},\"items\":[{\"productId\":\"<ID_DO_PRODUTO>\",\"quantity\":2}]}"

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
│   ├── css/styles.css        # Estilos
│   └── js/
│       ├── api.js            # Cliente HTTP da API
│       └── app.js            # Lógica da interface
├── src/
│   ├── app.js                # Configuração do Express e Swagger
│   ├── config.js             # Variáveis de ambiente
│   ├── db.js                 # MongoDB em memória
│   ├── seed.js               # Dados de teste
│   ├── middleware/
│   │   ├── auth.js           # Validação do JWT
│   │   └── error.js          # Tratamento de erros/404
│   ├── models/               # User, Product, Order, AuditLog, Counter
│   ├── routes/               # auth, products, orders
│   ├── services/orders.js    # Regras de negócio dos pedidos
│   └── utils/                # Dinheiro, erros HTTP e serializadores
├── server.js                 # Bootstrap da aplicação
├── .env.example
├── package.json
└── README.md
```

---

## Observações

- **Não há suíte de testes automatizados** neste projeto, por decisão de escopo.
- O frontend não usa framework nem bundler: é servido diretamente pelo Express.
- A documentação Swagger permite autenticar com o botão **Authorize** usando o token do
  login, e assim testar os endpoints protegidos.
- Para encerrar o servidor, use `Ctrl+C`; o processo desliga o MongoDB em memória
  corretamente.
