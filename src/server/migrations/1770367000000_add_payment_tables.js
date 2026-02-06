export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable('payment_transactions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true
    },
    user_id: {
      type: 'bigint',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    order_id: {
      type: 'varchar(255)',
      notNull: true,
      unique: true
    },
    gross_amount: {
      type: 'integer',
      notNull: true
    },
    payment_type: {
      type: 'varchar(32)',
      notNull: true
    },
    status: {
      type: 'varchar(32)',
      notNull: true
    },
    midtrans_transaction_id: {
      type: 'varchar(255)'
    },
    midtrans_response_json: {
      type: 'jsonb'
    },
    created_at: {
      type: 'timestamp',
      notNull: true
    },
    updated_at: {
      type: 'timestamp',
      notNull: true
    },
    paid_at: {
      type: 'timestamp'
    }
  });

  pgm.createIndex('payment_transactions', 'order_id', { unique: true });
  pgm.createIndex('payment_transactions', 'user_id');
  pgm.createIndex('payment_transactions', 'status');
  pgm.createIndex('payment_transactions', 'midtrans_transaction_id', { unique: true });

  pgm.createTable('payment_webhook_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true
    },
    received_at: {
      type: 'timestamp',
      notNull: true
    },
    order_id: {
      type: 'varchar(255)'
    },
    midtrans_transaction_id: {
      type: 'varchar(255)'
    },
    raw_body: {
      type: 'jsonb',
      notNull: true
    },
    signature_key: {
      type: 'varchar(255)'
    },
    is_verified: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    processed: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    processing_error: {
      type: 'text'
    }
  });

  pgm.createIndex('payment_webhook_events', 'order_id');
  pgm.createIndex('payment_webhook_events', 'midtrans_transaction_id');
};

export const down = (pgm) => {
  pgm.dropTable('payment_webhook_events');
  pgm.dropTable('payment_transactions');
};
