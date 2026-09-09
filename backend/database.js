require('dotenv').config(); // carrega o .env pras variáveis process.env.*
const mysql = require('mysql2/promise'); // versão "promise" = dá pra usar await
const bcrypt = require('bcrypt');

// Se existir MYSQL_URL (formato do Railway: mysql://usuario:senha@host:porta/banco),
// usa ela direto. Senão, monta a conexão peça por peça (pro seu ambiente local).
const pool = process.env.MYSQL_URL
  ? mysql.createPool(process.env.MYSQL_URL)
  : mysql.createPool({
      host: process.env.MYSQLHOST || process.env.DB_HOST,
      port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
      user: process.env.MYSQLUSER || process.env.DB_USER,
      password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
      database: process.env.MYSQLDATABASE || process.env.DB_NAME,
    });
    
async function criarTabelas() {
  // ============================================================
  // USUÁRIOS (dentistas e recepcionistas que fazem login)
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      papel ENUM('dentista', 'recepcionista', 'admin') NOT NULL DEFAULT 'dentista',
      crm VARCHAR(50),
      cargo VARCHAR(100),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // CLÍNICA (dados usados no cabeçalho de PDFs — receita, laudo etc.)
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clinica (
      id INT PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      endereco VARCHAR(255),
      telefone VARCHAR(30)
    );
  `);

  // ============================================================
  // PACIENTES
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pacientes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(150) NOT NULL,
      cpf VARCHAR(20) UNIQUE,
      telefone VARCHAR(30),
      email VARCHAR(150),
      nascimento VARCHAR(20),
      endereco VARCHAR(255),
      convenio VARCHAR(100),
      status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // AGENDAMENTOS
  // ============================================================
  // "hoje" = WHERE data = data de hoje; "histórico de um paciente" =
  // WHERE paciente_id = X ORDER BY data DESC — uma tabela só pros dois casos.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      paciente_id INT NOT NULL,
      dentista_id INT,
      data DATE NOT NULL,
      horario VARCHAR(10) NOT NULL,
      procedimento VARCHAR(150) NOT NULL,
      status ENUM('agendado', 'confirmado', 'concluido', 'cancelado', 'faltou') NOT NULL DEFAULT 'agendado',
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
      FOREIGN KEY (dentista_id) REFERENCES usuarios(id)
    );
  `);

  // ============================================================
  // DIAGNÓSTICOS / OBSERVAÇÕES (ficha do paciente)
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS diagnosticos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      paciente_id INT NOT NULL,
      titulo VARCHAR(200) NOT NULL,
      texto TEXT NOT NULL,
      texto_original_ia TEXT,
      diagnostico_dentista TEXT,
      gerado_por_ia TINYINT(1) NOT NULL DEFAULT 0,
      aprovado_pelo_dentista TINYINT(1) NOT NULL DEFAULT 0,
      aprovado_por INT,
      aprovado_em VARCHAR(50),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
      FOREIGN KEY (aprovado_por) REFERENCES usuarios(id)
    );
  `);

  // ============================================================
  // ANÁLISES DE IA + ACHADOS
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analises_ia (
      id INT PRIMARY KEY AUTO_INCREMENT,
      paciente_id INT,
      quantidade_imagens INT NOT NULL DEFAULT 0,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS achados_ia (
      id INT PRIMARY KEY AUTO_INCREMENT,
      analise_id INT NOT NULL,
      dente VARCHAR(50) NOT NULL,
      achado VARCHAR(255) NOT NULL,
      confianca INT NOT NULL,
      FOREIGN KEY (analise_id) REFERENCES analises_ia(id) ON DELETE CASCADE
    );
  `);

  // ============================================================
  // CHAT (conversas + mensagens)
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversas (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(150) NOT NULL,
      papel VARCHAR(50) NOT NULL,
      paciente_id INT,
      FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mensagens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      conversa_id INT NOT NULL,
      autor ENUM('eu', 'outro') NOT NULL,
      texto TEXT NOT NULL,
      enviado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE
    );
  `);

  // ============================================================
  // RECEITAS
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receitas (
      id INT PRIMARY KEY AUTO_INCREMENT,
      paciente_id INT NOT NULL,
      dentista_id INT,
      texto TEXT NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
      FOREIGN KEY (dentista_id) REFERENCES usuarios(id)
    );
  `);
}

async function inserirDadosIniciais() {
  const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE email = ?', ['carlos@odontoai.com']);

  if (usuarios.length === 0) {
    const senhaHash = await bcrypt.hash('123456', 10); // NUNCA salvar a senha "crua"
    await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, papel, crm, cargo) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Dr. Carlos', 'carlos@odontoai.com', senhaHash, 'dentista', 'CRO-SP 45.678', 'Cirurgião-Dentista']
    );
    console.log('Usuário de teste criado: carlos@odontoai.com / senha: 123456');
  }

  const [clinicas] = await pool.query('SELECT * FROM clinica WHERE id = 1');

  if (clinicas.length === 0) {
    await pool.query(
      `INSERT INTO clinica (id, nome, endereco, telefone) VALUES (1, ?, ?, ?)`,
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