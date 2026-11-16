-- ============================================================================
-- Esquema MariaDB para Herramientas de Diseño Nodos (Créditos + API Procesos)
-- Compatible con MariaDB 10.4+ / MySQL 8.0+
-- ============================================================================

CREATE DATABASE IF NOT EXISTS cortesmail
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cortesmail;

-- 1. Tabla de Usuarios / Clientes
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(40) NULL COMMENT 'WhatsApp / Celular para Yape/Plin',
  credits_balance INT NOT NULL DEFAULT 10,
  total_processes INT UNSIGNED NOT NULL DEFAULT 0,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_phone (phone),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de API Keys (sirve tanto para autenticar la Web/App Windows como para la API)
CREATE TABLE IF NOT EXISTS api_keys (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  key_token VARCHAR(80) NOT NULL UNIQUE COMMENT 'Ej: nk_live_8f92a3b4c5d6...',
  label VARCHAR(100) NOT NULL DEFAULT 'Principal',
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_api_keys_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  INDEX idx_api_keys_token (key_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Historial de Transacciones de Créditos (Recargas por Yape/Plin/BCP y Consumos)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  amount INT NOT NULL COMMENT 'Positivo = recarga (+50), Negativo = consumo (-1)',
  balance_after INT NOT NULL,
  payment_method ENUM('welcome', 'yape', 'plin', 'bcp', 'interbank', 'manual', 'usage') NOT NULL DEFAULT 'manual',
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  INDEX idx_transactions_user_date (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Solicitudes de Recarga de Créditos enviadas por los clientes (Yape / Plin / Bancos)
CREATE TABLE IF NOT EXISTS credit_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  credits_requested INT UNSIGNED NOT NULL,
  price_pen DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  payment_method ENUM('yape', 'plin', 'bcp', 'interbank', 'otro') NOT NULL DEFAULT 'yape',
  operation_code VARCHAR(80) NOT NULL COMMENT 'Nro de operación o celular Yape/Plin',
  sender_name VARCHAR(120) NULL COMMENT 'Nombre de quien yapeó/transfirió',
  note VARCHAR(255) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_requests_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  INDEX idx_requests_status_date (status, created_at DESC),
  INDEX idx_requests_user (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Registro de Procesos de Corte (Web, App Windows y API Pública)
CREATE TABLE IF NOT EXISTS process_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  api_key_id INT UNSIGNED NULL,
  source_type ENUM('web', 'windows', 'api') NOT NULL DEFAULT 'web',
  action_type ENUM('zip', 'batch', 'slice', 'api_slice') NOT NULL DEFAULT 'zip',
  files_count INT UNSIGNED NOT NULL DEFAULT 1,
  slices_count INT UNSIGNED NOT NULL DEFAULT 1,
  credits_used INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_logs_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  INDEX idx_logs_user_date (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usuario Demo inicial (opcional)
INSERT IGNORE INTO users (id, name, email, phone, credits_balance, role)
VALUES (1, 'Cliente Demo Perú', 'demo@nodos.pe', '999888777', 25, 'user');

INSERT IGNORE INTO api_keys (id, user_id, key_token, label)
VALUES (1, 1, 'nk_live_demo_peru_2026', 'Licencia Demo Web/Windows');
