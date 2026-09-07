// server.js
// ------------------------------------------------------------------
// rotas da API.
// ------------------------------------------------------------------

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool, iniciarBanco } = require('./database');
const app = express();
const PORT = 3000;

app.use(express.json()); // permite ler JSON enviado pelo front-end (fetch/POST)

// Serve o frontend inteiro (HTML, CSS, JS, imagens) direto pelo Express —
// assim frontend e backend moram no mesmo endereço, sem precisar do Live Server
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'troque-essa-frase-por-algo-aleatorio-e-secreto',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8, // sessão dura 8 horas
    httpOnly: true,
  },
}));

// -------- Middleware de proteção --------
// Qualquer rota que usar isso só deixa passar se o usuário estiver logado.
function requireLogin(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Não autenticado. Faça login primeiro.' });
  }
}

// ============================================================
// ROTAS DE AUTENTICAÇÃO
// ============================================================

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    const usuario = usuarios[0];

    if (!usuario) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }

    const senhaCorreta = await bcrypt.compare(password, usuario.senha_hash);

    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }

    // Senha certa: cria a sessão
    req.session.userId = usuario.id;

    res.json({
      message: 'Login realizado com sucesso!',
      user: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, crm: usuario.crm },
    });
  } catch (erro) {
    console.error('Erro no login:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logout realizado.' });
  });
});

// GET /api/me — pro front-end saber "quem está logado agora"
app.get('/api/me', requireLogin, async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, nome, email, papel, crm, cargo FROM usuarios WHERE id = ?',
      [req.session.userId]
    );
    res.json(usuarios[0]);
  } catch (erro) {
    console.error('Erro ao buscar usuário:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});


// ============================================================
// ROTAS DASHBOARD
// ============================================================

// GET /api/dashboard?data=... — resumo completo pro Dashboard
app.get('/api/dashboard', requireLogin, async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().slice(0, 10);

    const [[{ totalPacientes }]] = await pool.query('SELECT COUNT(*) AS totalPacientes FROM pacientes');

    const [agendaHoje] = await pool.query(`
      SELECT agendamentos.*, pacientes.nome AS paciente_nome, usuarios.nome AS dentista_nome
      FROM agendamentos
      JOIN pacientes ON pacientes.id = agendamentos.paciente_id
      LEFT JOIN usuarios ON usuarios.id = agendamentos.dentista_id
      WHERE agendamentos.data = ? ORDER BY agendamentos.horario ASC
    `, [data]);

    const [[{ total: consultasOntem }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM agendamentos WHERE data = DATE_SUB(?, INTERVAL 1 DAY)', [data]
    );

    const [semanaBruta] = await pool.query(`
      SELECT data, COUNT(*) AS total FROM agendamentos
      WHERE data BETWEEN DATE_SUB(?, INTERVAL WEEKDAY(?) DAY)
                      AND DATE_ADD(DATE_SUB(?, INTERVAL WEEKDAY(?) DAY), INTERVAL 6 DAY)
      GROUP BY data
    `, [data, data, data, data]);

    const [[statusGeral]] = await pool.query(`
      SELECT
        SUM(status = 'concluido') AS concluidas,
        SUM(status IN ('agendado','confirmado')) AS agendadas,
        SUM(status IN ('cancelado','faltou')) AS canceladas,
        COUNT(*) AS total
      FROM agendamentos
    `);

    res.json({ totalPacientes, agendaHoje, consultasOntem, semanaBruta, statusGeral });
  } catch (erro) {
    console.error('Erro ao buscar resumo do dashboard:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE PACIENTES
// ============================================================

app.get('/api/pacientes', requireLogin, async (req, res) => {
  try {
    const [pacientes] = await pool.query(`
      SELECT pacientes.*,
        (SELECT MAX(data) FROM agendamentos
         WHERE agendamentos.paciente_id = pacientes.id AND agendamentos.status = 'concluido') AS ultimaConsulta,
        (SELECT MIN(data) FROM agendamentos
         WHERE agendamentos.paciente_id = pacientes.id AND agendamentos.data >= CURDATE()
           AND agendamentos.status IN ('agendado', 'confirmado')) AS proximaConsulta
      FROM pacientes
      ORDER BY pacientes.nome ASC
    `);
    res.json(pacientes);
  } catch (erro) {
    console.error('Erro ao buscar pacientes:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// GET /api/pacientes/:id — busca um paciente específico (usado na Ficha do Paciente)
app.get('/api/pacientes/:id', requireLogin, async (req, res) => {
  try {
    const [pacientes] = await pool.query('SELECT * FROM pacientes WHERE id = ?', [req.params.id]);

    if (pacientes.length === 0) {
      return res.status(404).json({ error: 'Paciente não encontrado.' });
    }

    res.json(pacientes[0]);
  } catch (erro) {
    console.error('Erro ao buscar paciente:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// POST /api/pacientes — cria um paciente novo (usado no botão "Novo Paciente")
app.post('/api/pacientes', requireLogin, async (req, res) => {
  try {
    const { nome, cpf, telefone, email, nascimento, endereco, convenio, status } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }

    const [resultado] = await pool.query(
      `INSERT INTO pacientes (nome, cpf, telefone, email, nascimento, endereco, convenio, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, cpf || null, telefone || null, email || null, nascimento || null, endereco || null, convenio || null, status || 'ativo']
    );

    // Busca o paciente recém-criado pra devolver ele completo (com o id gerado)
    const [pacientes] = await pool.query('SELECT * FROM pacientes WHERE id = ?', [resultado.insertId]);
    res.status(201).json(pacientes[0]);
  } catch (erro) {
    console.error('Erro ao criar paciente:', erro);
    // Erro comum aqui: tentar cadastrar um CPF que já existe (por causa do UNIQUE na tabela)
    if (erro.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe um paciente com esse CPF.' });
    }
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// PUT /api/pacientes/:id — edita um paciente existente (usado no botão "Editar")
app.put('/api/pacientes/:id', requireLogin, async (req, res) => {
  try {
    const { nome, cpf, telefone, email, nascimento, endereco, convenio, status } = req.body;

    const [resultado] = await pool.query(
      `UPDATE pacientes
       SET nome = ?, cpf = ?, telefone = ?, email = ?, nascimento = ?, endereco = ?, convenio = ?, status = ?
       WHERE id = ?`,
      [nome, cpf || null, telefone || null, email || null, nascimento || null, endereco || null, convenio || null, status, req.params.id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Paciente não encontrado.' });
    }

    const [pacientes] = await pool.query('SELECT * FROM pacientes WHERE id = ?', [req.params.id]);
    res.json(pacientes[0]);
  } catch (erro) {
    console.error('Erro ao editar paciente:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE AGENDAMENTOS
// ============================================================

// GET /api/agendamentos?data=2026-08-22 — lista os agendamentos de um dia
// (usado no Dashboard "Agenda de Hoje" e na tela Agendamentos)
// Se não vier "?data=...", usa a data de hoje por padrão.
app.get('/api/agendamentos', requireLogin, async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().slice(0, 10); // "AAAA-MM-DD"

    const [agendamentos] = await pool.query(
      `SELECT agendamentos.*, pacientes.nome AS paciente_nome, usuarios.nome AS dentista_nome
       FROM agendamentos
       JOIN pacientes ON pacientes.id = agendamentos.paciente_id
       LEFT JOIN usuarios ON usuarios.id = agendamentos.dentista_id
       WHERE agendamentos.data = ?
       ORDER BY agendamentos.horario ASC`,
      [data]
    );

    res.json(agendamentos);
  } catch (erro) {
    console.error('Erro ao buscar agendamentos:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// GET /api/agendamentos/paciente/:id — histórico de consultas de UM paciente
// (usado na Ficha do Paciente, ordenado da mais recente pra mais antiga)
app.get('/api/agendamentos/paciente/:id', requireLogin, async (req, res) => {
  try {
    const [agendamentos] = await pool.query(
      `SELECT agendamentos.*, usuarios.nome AS dentista_nome
       FROM agendamentos
       LEFT JOIN usuarios ON usuarios.id = agendamentos.dentista_id
       WHERE agendamentos.paciente_id = ?
       ORDER BY agendamentos.data DESC`,
      [req.params.id]
    );

    res.json(agendamentos);
  } catch (erro) {
    console.error('Erro ao buscar histórico do paciente:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// POST /api/agendamentos — cria um agendamento novo
app.post('/api/agendamentos', requireLogin, async (req, res) => {
  try {
    const { paciente_id, dentista_id, data, horario, procedimento, status } = req.body;

    if (!paciente_id || !data || !horario || !procedimento) {
      return res.status(400).json({ error: 'Paciente, data, horário e procedimento são obrigatórios.' });
    }

    const [resultado] = await pool.query(
      `INSERT INTO agendamentos (paciente_id, dentista_id, data, horario, procedimento, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [paciente_id, dentista_id || null, data, horario, procedimento, status || 'agendado']
    );

    const [agendamentos] = await pool.query(
      `SELECT agendamentos.*, pacientes.nome AS paciente_nome, usuarios.nome AS dentista_nome
       FROM agendamentos
       JOIN pacientes ON pacientes.id = agendamentos.paciente_id
       LEFT JOIN usuarios ON usuarios.id = agendamentos.dentista_id
       WHERE agendamentos.id = ?`,
      [resultado.insertId]
    );

    res.status(201).json(agendamentos[0]);
  } catch (erro) {
    console.error('Erro ao criar agendamento:', erro);
    // Erro comum aqui: paciente_id apontando pra um paciente que não existe
    if (erro.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Paciente ou dentista informado não existe.' });
    }
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// PUT /api/agendamentos/:id — edita (status, remarcar data/horário, etc.)
app.put('/api/agendamentos/:id', requireLogin, async (req, res) => {
  try {
    const { dentista_id, data, horario, procedimento, status } = req.body;

    const [resultado] = await pool.query(
      `UPDATE agendamentos
       SET dentista_id = ?, data = ?, horario = ?, procedimento = ?, status = ?
       WHERE id = ?`,
      [dentista_id || null, data, horario, procedimento, status, req.params.id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    const [agendamentos] = await pool.query(
      `SELECT agendamentos.*, pacientes.nome AS paciente_nome, usuarios.nome AS dentista_nome
       FROM agendamentos
       JOIN pacientes ON pacientes.id = agendamentos.paciente_id
       LEFT JOIN usuarios ON usuarios.id = agendamentos.dentista_id
       WHERE agendamentos.id = ?`,
      [req.params.id]
    );

    res.json(agendamentos[0]);
  } catch (erro) {
    console.error('Erro ao editar agendamento:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE DIAGNÓSTICOS
// ============================================================

// GET /api/diagnosticos/paciente/:id — lista os diagnósticos/observações
// de um paciente (usado na Ficha do Paciente, mais recente primeiro)
app.get('/api/diagnosticos/paciente/:id', requireLogin, async (req, res) => {
  try {
    const [diagnosticos] = await pool.query(
      `SELECT diagnosticos.*, usuarios.nome AS aprovado_por_nome
       FROM diagnosticos
       LEFT JOIN usuarios ON usuarios.id = diagnosticos.aprovado_por
       WHERE diagnosticos.paciente_id = ?
       ORDER BY diagnosticos.criado_em DESC`,
      [req.params.id]
    );

    res.json(diagnosticos);
  } catch (erro) {
    console.error('Erro ao buscar diagnósticos:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// POST /api/diagnosticos — cria um novo diagnóstico/observação
// (usado tanto por uma anotação manual quanto pelo "Vincular ao Paciente" da tela de IA)
app.post('/api/diagnosticos', requireLogin, async (req, res) => {
  try {
    const { paciente_id, titulo, texto, texto_original_ia, diagnostico_dentista, gerado_por_ia } = req.body;

    if (!paciente_id || !titulo || !texto) {
      return res.status(400).json({ error: 'Paciente, título e texto são obrigatórios.' });
    }

    // Quem está criando (pegamos da sessão, não confiamos no que o
    // front-end manda) é registrado como quem aprovou esse diagnóstico
    const [resultado] = await pool.query(
      `INSERT INTO diagnosticos
        (paciente_id, titulo, texto, texto_original_ia, diagnostico_dentista, gerado_por_ia, aprovado_pelo_dentista, aprovado_por, aprovado_em)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW())`,
      [
        paciente_id,
        titulo,
        texto,
        texto_original_ia || null,
        diagnostico_dentista || null,
        gerado_por_ia ? 1 : 0,
        req.session.userId,
      ]
    );

    const [diagnosticos] = await pool.query(
      `SELECT diagnosticos.*, usuarios.nome AS aprovado_por_nome
       FROM diagnosticos
       LEFT JOIN usuarios ON usuarios.id = diagnosticos.aprovado_por
       WHERE diagnosticos.id = ?`,
      [resultado.insertId]
    );

    res.status(201).json(diagnosticos[0]);
  } catch (erro) {
    console.error('Erro ao criar diagnóstico:', erro);
    if (erro.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Paciente informado não existe.' });
    }
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE ANÁLISES DE IA
// ============================================================

// Função auxiliar (não é uma rota) — busca uma análise já com os
// achados dela dentro, pra não repetir essa lógica em 3 rotas diferentes
async function buscarAnaliseCompleta(id) {
  const [analises] = await pool.query(
    `SELECT analises_ia.*, pacientes.nome AS paciente_nome
     FROM analises_ia
     LEFT JOIN pacientes ON pacientes.id = analises_ia.paciente_id
     WHERE analises_ia.id = ?`,
    [id]
  );

  if (analises.length === 0) return null;

  const analise = analises[0];
  const [achados] = await pool.query('SELECT * FROM achados_ia WHERE analise_id = ?', [id]);
  analise.achados = achados;

  return analise;
}

// GET /api/analises-ia — histórico de todas as análises (mais recente primeiro)
app.get('/api/analises-ia', requireLogin, async (req, res) => {
  try {
    const [analises] = await pool.query(
      `SELECT analises_ia.*, pacientes.nome AS paciente_nome
       FROM analises_ia
       LEFT JOIN pacientes ON pacientes.id = analises_ia.paciente_id
       ORDER BY analises_ia.criado_em DESC`
    );

    // Pra cada análise, busca os achados dela (um paciente pode ter 1 a 3 achados)
    for (const analise of analises) {
      const [achados] = await pool.query('SELECT * FROM achados_ia WHERE analise_id = ?', [analise.id]);
      analise.achados = achados;
    }

    res.json(analises);
  } catch (erro) {
    console.error('Erro ao buscar análises:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// GET /api/analises-ia/:id — uma análise específica (reabrir do histórico)
app.get('/api/analises-ia/:id', requireLogin, async (req, res) => {
  try {
    const analise = await buscarAnaliseCompleta(req.params.id);

    if (!analise) {
      return res.status(404).json({ error: 'Análise não encontrada.' });
    }

    res.json(analise);
  } catch (erro) {
    console.error('Erro ao buscar análise:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// POST /api/analises-ia — cria uma análise nova, já com os achados
// Corpo esperado: { paciente_id (opcional), quantidade_imagens, achados: [{dente, achado, confianca}, ...] }
app.post('/api/analises-ia', requireLogin, async (req, res) => {
  try {
    const { paciente_id, quantidade_imagens, achados } = req.body;

    if (!Array.isArray(achados) || achados.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um achado.' });
    }

    const [resultado] = await pool.query(
      `INSERT INTO analises_ia (paciente_id, quantidade_imagens) VALUES (?, ?)`,
      [paciente_id || null, quantidade_imagens || 0]
    );

    const analiseId = resultado.insertId;

    // Insere cada achado, um de cada vez, ligado à análise que acabamos de criar
    for (const item of achados) {
      await pool.query(
        `INSERT INTO achados_ia (analise_id, dente, achado, confianca) VALUES (?, ?, ?, ?)`,
        [analiseId, item.dente, item.achado, item.confianca]
      );
    }

    const analiseCompleta = await buscarAnaliseCompleta(analiseId);
    res.status(201).json(analiseCompleta);
  } catch (erro) {
    console.error('Erro ao criar análise:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// PUT /api/analises-ia/:id/vincular — vincula (ou troca) o paciente de uma análise
// já feita (usado no botão "Vincular ao Paciente" da tela de IA)
app.put('/api/analises-ia/:id/vincular', requireLogin, async (req, res) => {
  try {
    const { paciente_id } = req.body;

    if (!paciente_id) {
      return res.status(400).json({ error: 'paciente_id é obrigatório.' });
    }

    const [resultado] = await pool.query(
      'UPDATE analises_ia SET paciente_id = ? WHERE id = ?',
      [paciente_id, req.params.id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Análise não encontrada.' });
    }

    const analiseCompleta = await buscarAnaliseCompleta(req.params.id);
    res.json(analiseCompleta);
  } catch (erro) {
    console.error('Erro ao vincular análise:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE CHAT (conversas + mensagens)
// ============================================================

// GET /api/conversas — lista todas as conversas (usado na lista à esquerda do Chat)
app.get('/api/conversas', requireLogin, async (req, res) => {
  try {
    const [conversas] = await pool.query('SELECT * FROM conversas ORDER BY id ASC');
    res.json(conversas);
  } catch (erro) {
    console.error('Erro ao buscar conversas:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// POST /api/conversas — cria uma conversa nova
app.post('/api/conversas', requireLogin, async (req, res) => {
  try {
    const { nome, papel, paciente_id } = req.body;

    if (!nome || !papel) {
      return res.status(400).json({ error: 'Nome e papel são obrigatórios.' });
    }

    const [resultado] = await pool.query(
      'INSERT INTO conversas (nome, papel, paciente_id) VALUES (?, ?, ?)',
      [nome, papel, paciente_id || null]
    );

    const [conversas] = await pool.query('SELECT * FROM conversas WHERE id = ?', [resultado.insertId]);
    res.status(201).json(conversas[0]);
  } catch (erro) {
    console.error('Erro ao criar conversa:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// GET /api/conversas/:id/mensagens — lista as mensagens de UMA conversa
// (repara que a URL tem o id da conversa NO MEIO do caminho, não no final —
// isso é normal quando um recurso "pertence" a outro: mensagem sempre
// pertence a uma conversa, então a URL reflete essa relação)
app.get('/api/conversas/:id/mensagens', requireLogin, async (req, res) => {
  try {
    const [mensagens] = await pool.query(
      'SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY enviado_em ASC',
      [req.params.id]
    );
    res.json(mensagens);
  } catch (erro) {
    console.error('Erro ao buscar mensagens:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// POST /api/conversas/:id/mensagens — envia uma mensagem numa conversa
app.post('/api/conversas/:id/mensagens', requireLogin, async (req, res) => {
  try {
    const { autor, texto } = req.body;

    if (!autor || !texto) {
      return res.status(400).json({ error: 'Autor e texto são obrigatórios.' });
    }

    const [resultado] = await pool.query(
      'INSERT INTO mensagens (conversa_id, autor, texto) VALUES (?, ?, ?)',
      [req.params.id, autor, texto]
    );

    const [mensagens] = await pool.query('SELECT * FROM mensagens WHERE id = ?', [resultado.insertId]);
    res.status(201).json(mensagens[0]);
  } catch (erro) {
    console.error('Erro ao enviar mensagem:', erro);
    if (erro.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Conversa informada não existe.' });
    }
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE RECEITAS
// ============================================================

// GET /api/receitas/paciente/:id — histórico de receitas de um paciente
app.get('/api/receitas/paciente/:id', requireLogin, async (req, res) => {
  try {
    const [receitas] = await pool.query(
      `SELECT receitas.*, usuarios.nome AS dentista_nome, usuarios.crm AS dentista_crm
       FROM receitas
       LEFT JOIN usuarios ON usuarios.id = receitas.dentista_id
       WHERE receitas.paciente_id = ?
       ORDER BY receitas.criado_em DESC`,
      [req.params.id]
    );
    res.json(receitas);
  } catch (erro) {
    console.error('Erro ao buscar receitas:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// POST /api/receitas — cria uma receita nova (o PDF continua sendo gerado
// no navegador; aqui só guardamos o registro pra ter histórico depois)
app.post('/api/receitas', requireLogin, async (req, res) => {
  try {
    const { paciente_id, texto } = req.body;

    if (!paciente_id || !texto) {
      return res.status(400).json({ error: 'Paciente e texto da receita são obrigatórios.' });
    }

    // O dentista que está criando é sempre quem está logado agora
    const [resultado] = await pool.query(
      'INSERT INTO receitas (paciente_id, dentista_id, texto) VALUES (?, ?, ?)',
      [paciente_id, req.session.userId, texto]
    );

    const [receitas] = await pool.query(
      `SELECT receitas.*, usuarios.nome AS dentista_nome, usuarios.crm AS dentista_crm
       FROM receitas
       LEFT JOIN usuarios ON usuarios.id = receitas.dentista_id
       WHERE receitas.id = ?`,
      [resultado.insertId]
    );

    res.status(201).json(receitas[0]);
  } catch (erro) {
    console.error('Erro ao criar receita:', erro);
    if (erro.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Paciente informado não existe.' });
    }
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE CLÍNICA
// ============================================================

// GET /api/clinica — dados usados no cabeçalho de PDFs (receita etc.)
app.get('/api/clinica', requireLogin, async (req, res) => {
  try {
    const [clinicas] = await pool.query('SELECT * FROM clinica WHERE id = 1');
    res.json(clinicas[0] || null);
  } catch (erro) {
    console.error('Erro ao buscar clínica:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// PUT /api/clinica — edita os dados da clínica (usado em Configurações)
app.put('/api/clinica', requireLogin, async (req, res) => {
  try {
    const { nome, endereco, telefone } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome da clínica é obrigatório.' });
    }

    // "ON DUPLICATE KEY UPDATE" = insere se não existir (id=1), ou
    // atualiza se já existir — evita ter que checar antes com um SELECT
    await pool.query(
      `INSERT INTO clinica (id, nome, endereco, telefone) VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nome = ?, endereco = ?, telefone = ?`,
      [nome, endereco || null, telefone || null, nome, endereco || null, telefone || null]
    );

    const [clinicas] = await pool.query('SELECT * FROM clinica WHERE id = 1');
    res.json(clinicas[0]);
  } catch (erro) {
    console.error('Erro ao editar clínica:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTA DE USUÁRIOS ( só usada pra listar dentistas nos agendamentos)
// ============================================================

// GET /api/usuarios?papel=dentista — lista usuários, filtrando por papel se pedido
app.get('/api/usuarios', requireLogin, async (req, res) => {
  try {
    const { papel } = req.query;
    const [usuarios] = papel
      ? await pool.query('SELECT id, nome, email, papel, crm, cargo FROM usuarios WHERE papel = ? ORDER BY nome ASC', [papel])
      : await pool.query('SELECT id, nome, email, papel, crm, cargo FROM usuarios ORDER BY nome ASC');
    res.json(usuarios);
  } catch (erro) {
    console.error('Erro ao buscar usuários:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// GET /api/agendamentos/buscar?termo=maria — acha por nome, em QUALQUER data
app.get('/api/agendamentos/buscar', requireLogin, async (req, res) => {
  try {
    const termo = `%${req.query.termo || ''}%`;
    const [agendamentos] = await pool.query(`
      SELECT agendamentos.*, pacientes.nome AS paciente_nome, usuarios.nome AS dentista_nome
      FROM agendamentos
      JOIN pacientes ON pacientes.id = agendamentos.paciente_id
      LEFT JOIN usuarios ON usuarios.id = agendamentos.dentista_id
      WHERE pacientes.nome LIKE ?
      ORDER BY agendamentos.data DESC, agendamentos.horario ASC
      LIMIT 100
    `, [termo]);
    res.json(agendamentos);
  } catch (erro) {
    console.error('Erro ao buscar agendamentos:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// GET /api/agendamentos/semana?data=... — total de agendamentos na semana (seg-dom) daquela data
app.get('/api/agendamentos/semana', requireLogin, async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().slice(0, 10);
    const [linhas] = await pool.query(`
      SELECT COUNT(*) AS total FROM agendamentos
      WHERE data BETWEEN DATE_SUB(?, INTERVAL WEEKDAY(?) DAY)
                      AND DATE_ADD(DATE_SUB(?, INTERVAL WEEKDAY(?) DAY), INTERVAL 6 DAY)
    `, [data, data, data, data]);
    res.json({ total: linhas[0].total });
  } catch (erro) {
    console.error('Erro ao buscar resumo da semana:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// FIM DAS ROTAS  
// ============================================================


async function iniciar() {
  await iniciarBanco(); // garante que as tabelas existem antes do servidor começar a responder
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

iniciar();