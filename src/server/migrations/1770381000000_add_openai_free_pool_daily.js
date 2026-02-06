exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('openai_free_pool_daily', {
    date_key: {
      type: 'text',
      primaryKey: true,
      notNull: true
    },
    remaining_tokens: {
      type: 'bigint',
      notNull: true
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    }
  });
};

exports.down = (pgm) => {
  pgm.dropTable('openai_free_pool_daily');
};
