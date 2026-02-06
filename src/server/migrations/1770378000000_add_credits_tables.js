exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('credits_balances', {
    user_id: {
      type: 'bigint',
      primaryKey: true,
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    balance: {
      type: 'bigint',
      notNull: true,
      default: 0
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    }
  });

  pgm.createTable('credits_ledger', {
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
    delta: {
      type: 'bigint',
      notNull: true
    },
    reason: {
      type: 'text',
      notNull: true
    },
    ref_type: {
      type: 'text',
      notNull: true
    },
    ref_id: {
      type: 'text',
      notNull: true
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    }
  });

  pgm.createIndex('credits_ledger', ['reason', 'ref_type', 'ref_id'], { unique: true });
  pgm.createIndex('credits_ledger', 'user_id');
  pgm.createIndex('credits_ledger', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('credits_ledger');
  pgm.dropTable('credits_balances');
};
