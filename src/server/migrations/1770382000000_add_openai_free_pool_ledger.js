exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('openai_free_pool_ledger', {
    request_id: {
      type: 'text',
      notNull: true
    },
    date_key: {
      type: 'text',
      notNull: true
    },
    user_id: {
      type: 'bigint',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    tokens: {
      type: 'bigint',
      notNull: true
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    }
  });

  pgm.addConstraint(
    'openai_free_pool_ledger',
    'openai_free_pool_ledger_pk',
    {
      primaryKey: ['request_id']
    }
  );
};

exports.down = (pgm) => {
  pgm.dropTable('openai_free_pool_ledger');
};
