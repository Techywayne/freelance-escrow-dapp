#### FairPay 托管支付 DApp 中文说明

这个项目是一个运行在 Ethereum Sepolia 测试网上的自由职业付款系统。付款方先把测试币存入智能合约，完成工作后再把钱放给收款方。如果双方发生争议，可以由创建托管单时指定的仲裁人决定资金去向。

项目只用于课程作业和测试网演示，不能直接用于真实资金。合约目前也没有经过专业安全审计。

#### 先理解整个系统

普通 Flask 网站通常是浏览器向 Flask 发送请求，Flask 再读取数据库并返回结果。这个项目多了一层区块链，而且涉及资金的操作不能由 Flask 代替用户执行。

一次完整操作可以概括为：

用户点击网页按钮 → JavaScript 调用 MetaMask → 用户在 MetaMask 中确认 → MetaMask 把交易发送到 Sepolia → 智能合约执行规则 → 网页读取新的链上结果

项目中的四个主要部分各有自己的职责：

- HTML 和 CSS 负责页面内容及外观。
- JavaScript 负责连接钱包、收集表单数据、调用合约并更新页面。
- Flask 负责提供网页文件和公开的部署配置。
- Solidity 智能合约负责保管测试币，并判断谁可以放款、退款或处理争议。

其中，MetaMask 相当于用户的钱包和签名工具。用户的私钥一直保留在 MetaMask 中，不会发送给 Flask，也不会写进项目代码。

#### 文件夹结构

```text
escrow-payment-dapp/
├── contracts/
│   └── FreelanceEscrow.sol            智能合约
├── static/
│   ├── abi/
│   │   └── FreelanceEscrow.abi.json   合约接口说明
│   ├── css/
│   │   └── style.css                  页面样式
│   └── js/
│       ├── app.js                     页面操作和显示逻辑
│       └── blockchain.js              钱包与合约交互
├── templates/
│   └── index.html                     页面结构
├── tests/
│   ├── manual-test-cases.md           手动测试项目
│   └── test_app.py                    Flask 自动测试
├── app.py                             Flask 入口
├── requirements.txt                   正式运行依赖
├── requirements-dev.txt               测试依赖
├── render.yaml                        Render 部署配置
├── .env.example                       环境变量示例
└── README.md                           英文运行说明
```

初次阅读时，不必同时研究所有文件。建议按照 `app.py` → `index.html` → `app.js` → `blockchain.js` → `FreelanceEscrow.sol` 的顺序阅读。

#### Flask 后端在做什么

Flask 代码位于 `app.py`。程序通过 `create_app()` 创建应用，这种写法称为应用工厂。它比直接在全局位置堆放所有配置更容易测试，也方便以后添加新的路由。

程序读取四项环境变量：

- `CONTRACT_ADDRESS`：部署后的智能合约地址。
- `CHAIN_ID`：区块链网络编号，Sepolia 是 `11155111`。
- `NETWORK_NAME`：页面上显示的网络名称。
- `EXPLORER_URL`：区块浏览器地址，用来打开交易记录。

Flask 提供三个路由：

- `/` 返回 `templates/index.html`，也就是系统主页面。
- `/api/config` 把网络名称、Chain ID、合约地址和区块浏览器地址返回给 JavaScript。
- `/api/health` 返回 `{"status": "ok"}`，用于检查本地服务或 Render 服务是否正常运行。

`CONTRACT_ADDRESS` 会在服务器启动时检查格式。如果地址不是 `0x` 加 40 个十六进制字符，程序会直接报错，避免网页拿到明显错误的地址。

需要注意，Flask 在这一版中不负责发送区块链交易。这样做是有意安排的，因为如果后端替用户发送交易，就需要服务器保存私钥，风险会明显增加。当前方案让每名用户自己在 MetaMask 中确认操作。

#### HTML 页面如何组成

`templates/index.html` 只负责定义页面中有什么，不直接完成区块链操作。主要区域包括：

- 顶部钱包连接按钮。
- 钱包、网络和合约地址信息。
- 全局状态提示框。
- 本地合约地址设置区。
- 创建托管单的表单。
- 当前钱包相关的托管记录列表。
- 本次浏览器会话中的交易链接。

页面底部的 `<template id="escrow-template">` 比较特殊。它不是立即显示的内容，而是一张托管记录卡片的模板。JavaScript 每读取到一条链上记录，就复制一次这个模板，再填入编号、金额、地址和状态。

Flask 模板中的写法：

```html
{{ url_for('static', filename='css/style.css') }}
```

会由 Flask 转换成正确的静态文件地址。JavaScript 文件也使用了相同方式加载。

#### CSS 样式如何组织

`static/css/style.css` 负责颜色、间距、按钮、表单、记录卡片和手机布局。它不会改变业务数据，也不会直接调用 Flask 或区块链。

样式中经常出现两种布局：

- `display: grid` 用于页面的大块分栏，例如创建表单和托管记录区。
- `display: flex` 用于按钮、标题和较小范围的横向排列。

文件末尾的 `@media` 是响应式规则。当屏幕宽度低于 820px 或 520px 时，双栏页面会变成单栏，部分元素也会缩小。这样在手机的 MetaMask 内置浏览器中仍然可以操作。

#### JavaScript 为什么分成两个文件

JavaScript 被分成 `app.js` 和 `blockchain.js`，目的是把页面逻辑与区块链逻辑分开。如果以后更换页面样式，通常主要修改 `app.js`；如果更换合约函数或钱包调用方式，则主要修改 `blockchain.js`。

`blockchain.js` 中的 `EscrowClient` 类可以理解成一个区块链工具箱。它保存当前网络配置、钱包连接、登录账户和合约接口，并提供以下方法：

- `connect()` 请求连接 MetaMask。
- `ensureExpectedNetwork()` 检查当前是否为 Sepolia，并请求切换网络。
- `contract()` 根据合约地址、ABI 和当前签名账户创建合约对象。
- `createEscrow()` 创建并注资新的托管单。
- `getMyEscrows()` 读取当前钱包参与的托管单。
- `release()` 放款给收款方。
- `refund()` 把资金退给付款方。
- `dispute()` 发起争议。
- `resolve()` 让仲裁人决定资金去向。

`app.js` 处理用户看得到的部分。它监听按钮和表单事件，调用 `EscrowClient`，再根据返回结果更新页面。例如，用户提交创建表单时，执行顺序是：

读取表单 → 检查输入 → 调用 `client.createEscrow()` → 打开 MetaMask → 等待交易确认 → 刷新托管记录

代码中大量使用 `async` 和 `await`，原因是钱包请求和区块链交易都需要等待。`await transaction.wait()` 表示程序不只等待交易被发送，还会等待交易被区块确认。

`try`、`catch` 和 `finally` 用于处理错误及恢复按钮状态。用户拒绝签名、输入无效地址或使用错误网络时，页面不会直接停止运行，而是把错误转换成提示文字。

#### ABI 的作用

`static/abi/FreelanceEscrow.abi.json` 是智能合约的接口说明。它告诉 JavaScript：

- 合约中有哪些函数。
- 每个函数需要哪些参数。
- 函数是否需要支付 ETH。
- 函数会返回什么内容。
- 合约会产生哪些事件。

ABI 不包含合约的完整业务代码，也不是私钥。可以把它理解为 JavaScript 与 Solidity 之间共同使用的一份函数目录。

前端调用下面这段代码时：

```javascript
contract.createEscrow(payee, arbiter, serviceReference, { value })
```

ethers.js 会根据 ABI 把函数名和参数转换成区块链能够识别的数据。合约重新编译后，如果函数发生变化，应当使用编译器生成的新 ABI 替换现有文件，否则前端可能继续按照旧接口调用。

#### 智能合约保存了什么

`contracts/FreelanceEscrow.sol` 是资金和业务规则真正所在的位置。合约中的每个托管单使用 `Escrow` 结构保存以下数据：

- `payer`：付款方钱包地址。
- `payee`：收款方，也就是自由职业者的钱包地址。
- `arbiter`：仲裁人地址。
- `amount`：托管金额，单位在链上实际使用 Wei。
- `createdAt`：创建时的区块时间。
- `status`：当前资金状态。
- `disputed`：是否已经发起争议。
- `serviceReference`：服务名称或简短说明。

金额在页面上以 ETH 输入。ethers.js 的 `parseEther()` 会把 ETH 转成 Wei，再发送给合约；读取时使用 `formatEther()` 把 Wei 转回容易理解的 ETH。

#### 托管单的状态和权限

托管单共有三种基本状态：

- `Funded`：资金已经存入合约，等待处理。
- `Released`：资金已经支付给收款方。
- `Refunded`：资金已经退回付款方。

争议使用独立的 `disputed` 布尔值记录。正常情况下，付款方可以放款，收款方可以主动退款。付款方或收款方发起争议后，普通放款和退款都会停止，只能由指定仲裁人处理。

每个主要函数都会重新检查调用者身份和托管单状态。网页上的按钮隐藏只能改善使用体验，不能代替合约检查。即使有人绕过页面直接调用合约，没有相应权限仍然会被合约拒绝。

具体权限如下：

| 操作 | 可以执行的人 | 必要条件 |
| --- | --- | --- |
| 创建并注资 | 任意钱包 | 金额大于零，三名参与者互不相同 |
| 正常放款 | 付款方 | 状态为 Funded，尚未发生争议 |
| 主动退款 | 收款方 | 状态为 Funded，尚未发生争议 |
| 发起争议 | 付款方或收款方 | 状态为 Funded，争议尚未发起 |
| 争议裁决 | 仲裁人 | 状态为 Funded，而且已经发起争议 |

#### 创建托管单时发生了什么

用户填写收款方、仲裁人、服务说明和 ETH 金额，然后点击创建按钮。JavaScript 会先检查地址、说明和金额，再通过 MetaMask 调用 `createEscrow()`。

智能合约收到交易后会再次检查：

- 收款方和仲裁人不能是零地址。
- 支付金额必须大于零。
- 付款方、收款方和仲裁人不能是同一个地址。
- 服务说明不能为空，也不能超过 120 字节。

检查通过后，合约把数据写入 `escrows` 数组，同时把托管单编号加入三名参与者各自的编号列表。最后触发 `EscrowCreated` 事件。因为函数带有 `payable`，随交易发送的测试币会进入智能合约地址，由合约暂时保管。

#### 放款和退款如何避免重复执行

放款前，合约先确认托管单仍然处于 `Funded` 状态。然后把状态改成 `Released`，最后才向收款方转账。退款也是先把状态改成 `Refunded`，再把资金转给付款方。

这种“先检查、再修改状态、最后向外转账”的顺序称为检查、效果、交互模式。合约还使用了 `nonReentrant` 修饰器，防止外部账户在收款过程中重复进入同一个资金操作。两层处理都是为了降低重复提款和重入攻击风险。

一旦状态变成 `Released` 或 `Refunded`，同一个托管单不能再次放款或退款。如果实际转账失败，整笔区块链交易会回退，前面的状态修改也不会保留。

#### 页面如何找到当前用户的记录

合约中的 `participantEscrowIds` 使用钱包地址保存相关托管单编号。创建托管单时，同一个编号会分别加入付款方、收款方和仲裁人的列表。

钱包连接后，前端调用 `getEscrowIdsFor(account)` 取得编号，再逐项调用 `getEscrow(id)` 读取详细内容。`app.js` 根据当前钱包属于哪一种角色，决定显示哪些操作按钮。

这些按钮只是界面提示。最终权限仍由智能合约判断，因此修改网页代码不能让普通账户获得仲裁权限。

#### 环境变量和合约地址

智能合约部署到 Sepolia 后会得到一个固定地址。推荐在本地 PowerShell 中这样配置：

```powershell
$env:CONTRACT_ADDRESS="0x这里替换成实际合约地址"
python app.py
```

Flask 会通过 `/api/config` 把这个地址提供给浏览器。部署到 Render 时，应在 Render 的环境变量页面填写同一个地址。

如果服务器没有配置合约地址，网页也允许手工输入，并保存到当前浏览器的 `localStorage`。这个功能主要方便本地测试。正式演示时最好在服务器上配置地址，避免每台设备都要重新输入。

`.env.example` 只是变量名称示例。目前代码没有自动读取 `.env` 文件，因此不能只创建 `.env` 就期待 Flask 自动加载。可以使用 PowerShell 环境变量，或者在 Render 后台设置变量。

#### 如何在本地运行

进入项目文件夹后执行：

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:CONTRACT_ADDRESS="0x这里替换成实际合约地址"
python app.py
```

然后在浏览器打开 `http://127.0.0.1:5000`。访问 `/api/health` 时，如果看到 `{"status":"ok"}`，说明 Flask 已经启动。

运行自动测试使用：

```powershell
pytest
```

这些测试目前主要检查 Flask 页面、配置接口、健康检查、安全响应头和错误合约地址。智能合约的资金流程仍需在 Remix 或专门的 Solidity 测试环境中测试。

#### 如何部署智能合约

1. 在 Remix 中打开 `contracts/FreelanceEscrow.sol`。
2. 使用 Solidity 0.8.20 或兼容的 0.8.x 版本编译。
3. 在部署页面选择 Injected Provider，让 Remix 连接 MetaMask。
4. 确认 MetaMask 当前网络为 Sepolia，并准备少量 Sepolia 测试币。
5. 部署合约并保存合约地址。
6. 从 Remix 编译结果中复制 ABI，替换项目中的 ABI 文件。
7. 把合约地址配置到本地环境变量和 Render 环境变量。

Remix VM 只存在于 Remix 页面内部。使用 Remix VM 部署得到的地址不能被这个独立网站访问，因此必须使用连接到 Sepolia 的 Injected Provider。

#### 测试时为什么需要三个钱包

托管单包含付款方、收款方和仲裁人三个不同角色，合约还明确禁止三者使用相同地址。因此完整测试至少需要三个 Sepolia 账户。

可以在同一个 MetaMask 中创建三个测试账户，然后分别切换身份。建议先记录每个账户的用途，避免操作时混淆：

- Account 1：付款方。
- Account 2：自由职业者。
- Account 3：仲裁人。

先测试正常放款，再创建另一张托管单测试主动退款。争议流程需要再创建托管单，由付款方或收款方发起争议，最后切换到仲裁人账户完成裁决。`tests/manual-test-cases.md` 列出了需要检查的具体场景。

#### 当前版本的边界

这是一版能够展示完整基本流程的课程项目代码，但仍有一些限制：

- 没有截止日期和自动退款机制。
- 一张托管单只支持一次性付款，不支持多个里程碑。
- 仲裁人由付款方指定，系统暂时没有更换仲裁人的方法。
- 服务说明直接公开保存在区块链上，不能修改，也不适合填写隐私信息。
- 页面中的交易活动只保留当前浏览器会话，刷新后不会继续显示；托管单状态仍然保存在链上。
- Flask 目前主要负责网页和部署配置，后端业务较轻。
- 合约尚未经过专业审计，不能用于真实资产。

后续版本可以增加合约自动测试、事件历史查询、里程碑付款、截止日期、仲裁人选择规则和更完整的后端功能。第一版应先完成 Sepolia 部署及三账户测试，确认现有流程稳定后再扩展，避免功能越加越多却没有一条完整流程能够演示。
