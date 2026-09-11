// server.js
// ------------------------------------------------------------------
// Versão PostgreSQL. Principais mudanças em relação à versão MySQL:
// - "?" virou "$1, $2, $3..." nas consultas
// - pool.query devolve { rows } em vez de [rows]
// - pra pegar o id de um INSERT, usamos "RETURNING id" (em vez de
//   resultado.insertId, que só existe no mysql2)
// - "ON DUPLICATE KEY UPDATE" virou "ON CONFLICT ... DO UPDATE SET"
// - cálculos de data (semana, ontem) agora são feitos em JavaScript,
//   e só o resultado (uma data pronta) é mandado pro banco — assim não
//   dependemos de funções de data que MySQL e Postgres escrevem diferente
// ------------------------------------------------------------------

require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { pool, iniciarBanco } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'troque-essa-frase-por-algo-aleatorio-e-secreto',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
  },
}));

function requireLogin(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Não autenticado. Faça login primeiro.' });
  }
}

// -------- Helpers de data (calculados em JS, não no banco) --------
function formatarDataISO(data) {
  return data.toISOString().slice(0, 10);
}

function calcularSemana(dataString) {
  const data = new Date(`${dataString}T00:00:00Z`);
  const diaSemana = data.getUTCDay(); // 0 = domingo
  const offsetSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const segunda = new Date(data);
  segunda.setUTCDate(data.getUTCDate() + offsetSegunda);
  const domingo = new Date(segunda);
  domingo.setUTCDate(segunda.getUTCDate() + 6);
  return { segunda: formatarDataISO(segunda), domingo: formatarDataISO(domingo) };
}

function calcularOntem(dataString) {
  const data = new Date(`${dataString}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - 1);
  return formatarDataISO(data);
}

// ============================================================
// ROTAS DE AUTENTICAÇÃO
// ============================================================

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];

    if (!usuario) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }

    const senhaCorreta = await bcrypt.compare(password, usuario.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }

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

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logout realizado.' });
  });
});

app.get('/api/me', requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nome, email, papel, crm, cargo FROM usuarios WHERE id = $1',
      [req.session.userId]
    );
    res.json(rows[0]);
  } catch (erro) {
    console.error('Erro ao buscar usuário:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE USUÁRIOS (dentistas)
// ============================================================

app.get('/api/usuarios', requireLogin, async (req, res) => {
  try {
    const { papel } = req.query;
    const { rows } = papel
      ? await pool.query('SELECT id, nome, email, papel, crm, cargo FROM usuarios WHERE papel = $1 ORDER BY nome ASC', [papel])
      : await pool.query('SELECT id, nome, email, papel, crm, cargo FROM usuarios ORDER BY nome ASC');
    res.json(rows);
  } catch (erro) {
    console.error('Erro ao buscar usuários:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE PACIENTES
// ============================================================

app.get('/api/pacientes', requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pacientes.*,
        (SELECT MAX(data) FROM agendamentos
         WHERE agendamentos.paciente_id = pacientes.id AND agendamentos.status = 'concluido') AS "ultimaConsulta",
        (SELECT MIN(data) FROM agendamentos
         WHERE agendamentos.paciente_id = pacientes.id AND agendamentos.data >= CURRENT_DATE
           AND agendamentos.status IN ('agendado', 'confirmado')) AS "proximaConsulta"
      FROM pacientes
      ORDER BY pacientes.nome ASC
    `);
    res.json(rows);
  } catch (erro) {
    console.error('Erro ao buscar pacientes:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.get('/api/pacientes/:id', requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM pacientes WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Paciente não encontrado.' });
    }
    res.json(rows[0]);
  } catch (erro) {
    console.error('Erro ao buscar paciente:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/pacientes', requireLogin, async (req, res) => {
  try {
    const { nome, cpf, telefone, email, nascimento, endereco, convenio, status } = req.body;
    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO pacientes (nome, cpf, telefone, email, nascimento, endereco, convenio, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nome, cpf || null, telefone || null, email || null, nascimento || null, endereco || null, convenio || null, status || 'ativo']
    );

    res.status(201).json(rows[0]);
  } catch (erro) {
    console.error('Erro ao criar paciente:', erro);
    if (erro.code === '23505') { // código do Postgres pra "violação de UNIQUE"
      return res.status(409).json({ error: 'Já existe um paciente com esse CPF.' });
    }
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.put('/api/pacientes/:id', requireLogin, async (req, res) => {
  try {
    const { nome, cpf, telefone, email, nascimento, endereco, convenio, status } = req.body;

    const { rows, rowCount } = await pool.query(
      `UPDATE pacientes
       SET nome = $1, cpf = $2, telefone = $3, email = $4, nascimento = $5, endereco = $6, convenio = $7, status = $8
       WHERE id = $9 RETURNING *`,
      [nome, cpf || null, telefone || null, email || null, nascimento || null, endereco || null, convenio || null, status, req.params.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Paciente não encontrado.' });
    }

    res.json(rows[0]);
  } catch (erro) {
    console.error('Erro ao editar paciente:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE AGENDAMENTOS
// ============================================================

const SELECT_AGENDAMENTO_COMPLETO = `
  SELECT agendamentos.*, pacientes.nome AS paciente_nome, usuarios.nome AS dentista_nome
  FROM agendamentos
  JOIN pacientes ON pacientes.id = agendamentos.paciente_id
  LEFT JOIN usuarios ON usuarios.id = agendamentos.dentista_id
`;

app.get('/api/agendamentos', requireLogin, async (req, res) => {
  try {
    const data = req.query.data || formatarDataISO(new Date());
    const { rows } = await pool.query(
      `${SELECT_AGENDAMENTO_COMPLETO} WHERE agendamentos.data = $1 ORDER BY agendamentos.horario ASC`,
      [data]
    );
    res.json(rows);
  } catch (erro) {
    console.error('Erro ao buscar agendamentos:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.get('/api/agendamentos/buscar', requireLogin, async (req, res) => {
  try {
    const termo = `%${req.query.termo || ''}%`;
    const { rows } = await pool.query(
      `${SELECT_AGENDAMENTO_COMPLETO} WHERE pacientes.nome ILIKE $1
       ORDER BY agendamentos.data DESC, agendamentos.horario ASC LIMIT 100`,
      [termo]
    );
    res.json(rows);
  } catch (erro) {
    console.error('Erro ao buscar agendamentos:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.get('/api/agendamentos/semana', requireLogin, async (req, res) => {
  try {
    const data = req.query.data || formatarDataISO(new Date());
    const { segunda, domingo } = calcularSemana(data);
    const { rows } = await pool.query(
      'SELECT COUNT(*) AS total FROM agendamentos WHERE data BETWEEN $1 AND $2',
      [segunda, domingo]
    );
    res.json({ total: Number(rows[0].total) });
  } catch (erro) {
    console.error('Erro ao buscar resumo da semana:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.get('/api/agendamentos/paciente/:id', requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT agendamentos.*, usuarios.nome AS dentista_nome
       FROM agendamentos
       LEFT JOIN usuarios ON usuarios.id = agendamentos.dentista_id
       WHERE agendamentos.paciente_id = $1
       ORDER BY agendamentos.data DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (erro) {
    console.error('Erro ao buscar histórico do paciente:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/agendamentos', requireLogin, async (req, res) => {
  try {
    const { paciente_id, dentista_id, data, horario, procedimento, status } = req.body;
    if (!paciente_id || !data || !horario || !procedimento) {
      return res.status(400).json({ error: 'Paciente, data, horário e procedimento são obrigatórios.' });
    }

    const { rows: novo } = await pool.query(
      `INSERT INTO agendamentos (paciente_id, dentista_id, data, horario, procedimento, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [paciente_id, dentista_id || null, data, horario, procedimento, status || 'agendado']
    );

    const { rows } = await pool.query(
      `${SELECT_AGENDAMENTO_COMPLETO} WHERE agendamentos.id = $1`,
      [novo[0].id]
    );

    res.status(201).json(rows[0]);
  } catch (erro) {
    console.error('Erro ao criar agendamento:', erro);
    if (erro.code === '23503') { // violação de FOREIGN KEY no Postgres
      return res.status(400).json({ error: 'Paciente ou dentista informado não existe.' });
    }
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.put('/api/agendamentos/:id', requireLogin, async (req, res) => {
  try {
    const { dentista_id, data, horario, procedimento, status } = req.body;

    const { rowCount } = await pool.query(
      `UPDATE agendamentos SET dentista_id = $1, data = $2, horario = $3, procedimento = $4, status = $5 WHERE id = $6`,
      [dentista_id || null, data, horario, procedimento, status, req.params.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    const { rows } = await pool.query(
      `${SELECT_AGENDAMENTO_COMPLETO} WHERE agendamentos.id = $1`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (erro) {
    console.error('Erro ao editar agendamento:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE DIAGNÓSTICOS
// ============================================================

app.get('/api/diagnosticos/paciente/:id', requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT diagnosticos.*, usuarios.nome AS aprovado_por_nome
       FROM diagnosticos
       LEFT JOIN usuarios ON usuarios.id = diagnosticos.aprovado_por
       WHERE diagnosticos.paciente_id = $1
       ORDER BY diagnosticos.criado_em DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (erro) {
    console.error('Erro ao buscar diagnósticos:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/diagnosticos', requireLogin, async (req, res) => {
  try {
    const { paciente_id, titulo, texto, texto_original_ia, diagnostico_dentista, gerado_por_ia } = req.body;
    if (!paciente_id || !titulo || !texto) {
      return res.status(400).json({ error: 'Paciente, título e texto são obrigatórios.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO diagnosticos
        (paciente_id, titulo, texto, texto_original_ia, diagnostico_dentista, gerado_por_ia, aprovado_pelo_dentista, aprovado_por, aprovado_em)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, NOW())
       RETURNING *`,
      [paciente_id, titulo, texto, texto_original_ia || null, diagnostico_dentista || null, !!gerado_por_ia, req.session.userId]
    );

    res.status(201).json(rows[0]);
  } catch (erro) {
    console.error('Erro ao criar diagnóstico:', erro);
    if (erro.code === '23503') {
      return res.status(400).json({ error: 'Paciente informado não existe.' });
    }
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE ANÁLISES DE IA
// ============================================================

async function buscarAnaliseCompleta(id) {
  const { rows } = await pool.query(
    `SELECT analises_ia.*, pacientes.nome AS paciente_nome
     FROM analises_ia
     LEFT JOIN pacientes ON pacientes.id = analises_ia.paciente_id
     WHERE analises_ia.id = $1`,
    [id]
  );
  if (rows.length === 0) return null;

  const analise = rows[0];
  const { rows: achados } = await pool.query('SELECT * FROM achados_ia WHERE analise_id = $1', [id]);
  analise.achados = achados;
  return analise;
}

app.get('/api/analises-ia', requireLogin, async (req, res) => {
  try {
    const { rows: analises } = await pool.query(`
      SELECT analises_ia.*, pacientes.nome AS paciente_nome
      FROM analises_ia
      LEFT JOIN pacientes ON pacientes.id = analises_ia.paciente_id
      ORDER BY analises_ia.criado_em DESC
    `);

    for (const analise of analises) {
      const { rows: achados } = await pool.query('SELECT * FROM achados_ia WHERE analise_id = $1', [analise.id]);
      analise.achados = achados;
    }

    res.json(analises);
  } catch (erro) {
    console.error('Erro ao buscar análises:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

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

app.post('/api/analises-ia', requireLogin, async (req, res) => {
  try {
    const { paciente_id, quantidade_imagens, achados } = req.body;
    if (!Array.isArray(achados) || achados.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um achado.' });
    }

    const { rows: nova } = await pool.query(
      `INSERT INTO analises_ia (paciente_id, quantidade_imagens) VALUES ($1, $2) RETURNING id`,
      [paciente_id || null, quantidade_imagens || 0]
    );
    const analiseId = nova[0].id;

    for (const item of achados) {
      await pool.query(
        `INSERT INTO achados_ia (analise_id, dente, achado, confianca) VALUES ($1, $2, $3, $4)`,
        [analiseId, item.dente, item.achado, item.confianca]
      );
    }

    res.status(201).json(await buscarAnaliseCompleta(analiseId));
  } catch (erro) {
    console.error('Erro ao criar análise:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.put('/api/analises-ia/:id/vincular', requireLogin, async (req, res) => {
  try {
    const { paciente_id } = req.body;
    if (!paciente_id) {
      return res.status(400).json({ error: 'paciente_id é obrigatório.' });
    }

    const { rowCount } = await pool.query('UPDATE analises_ia SET paciente_id = $1 WHERE id = $2', [paciente_id, req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Análise não encontrada.' });
    }

    res.json(await buscarAnaliseCompleta(req.params.id));
  } catch (erro) {
    console.error('Erro ao vincular análise:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE CHAT
// ============================================================

app.get('/api/conversas', requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM conversas ORDER BY id ASC');
    res.json(rows);
  } catch (erro) {
    console.error('Erro ao buscar conversas:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/conversas', requireLogin, async (req, res) => {
  try {
    const { nome, papel, paciente_id } = req.body;
    if (!nome || !papel) {
      return res.status(400).json({ error: 'Nome e papel são obrigatórios.' });
    }

    const { rows } = await pool.query(
      'INSERT INTO conversas (nome, papel, paciente_id) VALUES ($1, $2, $3) RETURNING *',
      [nome, papel, paciente_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (erro) {
    console.error('Erro ao criar conversa:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.get('/api/conversas/:id/mensagens', requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM mensagens WHERE conversa_id = $1 ORDER BY enviado_em ASC',
      [req.params.id]
    );
    res.json(rows);
  } catch (erro) {
    console.error('Erro ao buscar mensagens:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/conversas/:id/mensagens', requireLogin, async (req, res) => {
  try {
    const { autor, texto } = req.body;
    if (!autor || !texto) {
      return res.status(400).json({ error: 'Autor e texto são obrigatórios.' });
    }

    const { rows } = await pool.query(
      'INSERT INTO mensagens (conversa_id, autor, texto) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, autor, texto]
    );
    res.status(201).json(rows[0]);
  } catch (erro) {
    console.error('Erro ao enviar mensagem:', erro);
    if (erro.code === '23503') {
      return res.status(400).json({ error: 'Conversa informada não existe.' });
    }
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE RECEITAS
// ============================================================

app.get('/api/receitas/paciente/:id', requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT receitas.*, usuarios.nome AS dentista_nome, usuarios.crm AS dentista_crm
       FROM receitas
       LEFT JOIN usuarios ON usuarios.id = receitas.dentista_id
       WHERE receitas.paciente_id = $1
       ORDER BY receitas.criado_em DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (erro) {
    console.error('Erro ao buscar receitas:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/receitas', requireLogin, async (req, res) => {
  try {
    const { paciente_id, texto } = req.body;
    if (!paciente_id || !texto) {
      return res.status(400).json({ error: 'Paciente e texto da receita são obrigatórios.' });
    }

    const { rows: nova } = await pool.query(
      'INSERT INTO receitas (paciente_id, dentista_id, texto) VALUES ($1, $2, $3) RETURNING id',
      [paciente_id, req.session.userId, texto]
    );

    const { rows } = await pool.query(
      `SELECT receitas.*, usuarios.nome AS dentista_nome, usuarios.crm AS dentista_crm
       FROM receitas
       LEFT JOIN usuarios ON usuarios.id = receitas.dentista_id
       WHERE receitas.id = $1`,
      [nova[0].id]
    );
    res.status(201).json(rows[0]);
  } catch (erro) {
    console.error('Erro ao criar receita:', erro);
    if (erro.code === '23503') {
      return res.status(400).json({ error: 'Paciente informado não existe.' });
    }
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTAS DE CLÍNICA
// ============================================================

app.get('/api/clinica', requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clinica WHERE id = 1');
    res.json(rows[0] || null);
  } catch (erro) {
    console.error('Erro ao buscar clínica:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.put('/api/clinica', requireLogin, async (req, res) => {
  try {
    const { nome, endereco, telefone } = req.body;
    if (!nome) {
      return res.status(400).json({ error: 'Nome da clínica é obrigatório.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO clinica (id, nome, endereco, telefone) VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET nome = $1, endereco = $2, telefone = $3
       RETURNING *`,
      [nome, endereco || null, telefone || null]
    );
    res.json(rows[0]);
  } catch (erro) {
    console.error('Erro ao editar clínica:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
// ROTA DE RESUMO DO DASHBOARD
// ============================================================

app.get('/api/dashboard', requireLogin, async (req, res) => {
  try {
    const data = req.query.data || formatarDataISO(new Date());

    const { rows: totalRows } = await pool.query('SELECT COUNT(*) AS total FROM pacientes');
    const totalPacientes = Number(totalRows[0].total);

    const { rows: agendaHoje } = await pool.query(
      `${SELECT_AGENDAMENTO_COMPLETO} WHERE agendamentos.data = $1 ORDER BY agendamentos.horario ASC`,
      [data]
    );

    const ontem = calcularOntem(data);
    const { rows: ontemRows } = await pool.query('SELECT COUNT(*) AS total FROM agendamentos WHERE data = $1', [ontem]);
    const consultasOntem = Number(ontemRows[0].total);

    const { segunda, domingo } = calcularSemana(data);
    const { rows: semanaBruta } = await pool.query(
      'SELECT data, COUNT(*) AS total FROM agendamentos WHERE data BETWEEN $1 AND $2 GROUP BY data',
      [segunda, domingo]
    );

    const { rows: statusRows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'concluido') AS concluidas,
        COUNT(*) FILTER (WHERE status IN ('agendado', 'confirmado')) AS agendadas,
        COUNT(*) FILTER (WHERE status IN ('cancelado', 'faltou')) AS canceladas,
        COUNT(*) AS total
      FROM agendamentos
    `);
    const statusGeral = {
      concluidas: Number(statusRows[0].concluidas),
      agendadas: Number(statusRows[0].agendadas),
      canceladas: Number(statusRows[0].canceladas),
      total: Number(statusRows[0].total),
    };

    res.json({
      totalPacientes,
      agendaHoje,
      consultasOntem,
      semanaBruta: semanaBruta.map((s) => ({ data: s.data, total: Number(s.total) })),
      statusGeral,
    });
  } catch (erro) {
    console.error('Erro ao buscar resumo do dashboard:', erro);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// ============================================================
async function iniciar() {
  await iniciarBanco();
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

iniciar();