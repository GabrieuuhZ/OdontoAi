// database.js
// ------------------------------------------------------------------
// Versão PostgreSQL (Neon) — antes era MySQL. As tabelas são as mesmas
// 10 de sempre, só a sintaxe SQL muda um pouco:
// - AUTO_INCREMENT virou SERIAL
// - ENUM virou TEXT + CHECK (Postgres não tem ENUM inline como o MySQL)
// - TINYINT(1) virou BOOLEAN
// - Os placeholders viram $1, $2, $3... em vez de "?"
// ------------------------------------------------------------------

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// O Neon (e o Render, se você usar o Postgres dele) fornecem uma única
// variável DATABASE_URL com tudo junto (usuário, senha, host, porta, banco).
// O "ssl" é necessário porque esses serviços exigem conexão criptografada.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function criarTabelas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      papel TEXT NOT NULL DEFAULT 'dentista' CHECK (papel IN ('dentista', 'recepcionista', 'admin')),
      crm VARCHAR(50),
      cargo VARCHAR(100),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clinica (
      id INT PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      endereco VARCHAR(255),
      telefone VARCHAR(30)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pacientes (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      cpf VARCHAR(20) UNIQUE,
      telefone VARCHAR(30),
      email VARCHAR(150),
      nascimento VARCHAR(20),
      endereco VARCHAR(255),
      convenio VARCHAR(100),
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id SERIAL PRIMARY KEY,
      paciente_id INT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
      dentista_id INT REFERENCES usuarios(id),
      data DATE NOT NULL,
      horario VARCHAR(10) NOT NULL,
      procedimento VARCHAR(150) NOT NULL,
      status TEXT NOT NULL DEFAULT 'agendado'
        CHECK (status IN ('agendado', 'confirmado', 'concluido', 'cancelado', 'faltou')),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS diagnosticos (
      id SERIAL PRIMARY KEY,
      paciente_id INT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
      titulo VARCHAR(200) NOT NULL,
      texto TEXT NOT NULL,
      texto_original_ia TEXT,
      diagnostico_dentista TEXT,
      gerado_por_ia BOOLEAN NOT NULL DEFAULT FALSE,
      aprovado_pelo_dentista BOOLEAN NOT NULL DEFAULT FALSE,
      aprovado_por INT REFERENCES usuarios(id),
      aprovado_em VARCHAR(50),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analises_ia (
      id SERIAL PRIMARY KEY,
      paciente_id INT REFERENCES pacientes(id),
      quantidade_imagens INT NOT NULL DEFAULT 0,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS achados_ia (
      id SERIAL PRIMARY KEY,
      analise_id INT NOT NULL REFERENCES analises_ia(id) ON DELETE CASCADE,
      dente VARCHAR(50) NOT NULL,
      achado VARCHAR(255) NOT NULL,
      confianca INT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversas (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      papel VARCHAR(50) NOT NULL,
      paciente_id INT REFERENCES pacientes(id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mensagens (
      id SERIAL PRIMARY KEY,
      conversa_id INT NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
      autor TEXT NOT NULL CHECK (autor IN ('eu', 'outro')),
      texto TEXT NOT NULL,
      enviado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receitas (
      id SERIAL PRIMARY KEY,
      paciente_id INT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
      dentista_id INT REFERENCES usuarios(id),
      texto TEXT NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function inserirDadosIniciais() {
  const { rows: usuarios } = await pool.query('SELECT * FROM usuarios WHERE email = $1', ['carlos@odontoai.com']);

  if (usuarios.length === 0) {
    const senhaHash = await bcrypt.hash('123456', 10);
    await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, papel, crm, cargo) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['Dr. Carlos', 'carlos@odontoai.com', senhaHash, 'dentista', 'CRO-SP 45.678', 'Cirurgião-Dentista']
    );
    console.log('Usuário de teste criado: carlos@odontoai.com / senha: 123456');
  }

  const { rows: clinicas } = await pool.query('SELECT * FROM clinica WHERE id = 1');

  if (clinicas.length === 0) {
    await pool.query(
      `INSERT INTO clinica (id, nome, endereco, telefone) VALUES (1, $1, $2, $3)`,
      ['OdontoAI Clínica Odontológica', 'Av. Paulista, 1000 - São Paulo, SP - CEP 01310-100', '(11) 3000-0000']
    );
  }
}

async function iniciarBanco() {
  await criarTabelas();
  await inserirDadosIniciais();
  console.log('Banco de dados pronto!');
}

module.exports = { pool, iniciarBanco };