exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('openai_free_user_daily_usage', {
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
    used_tokens: {
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

  pgm.addConstraint(
    'openai_free_user_daily_usage',
    'openai_free_user_daily_usage_pk',
    {
      primaryKey: ['date_key', 'user_id']
    }
  );
};

exports.down = (pgm) => {
  pgm.dropTable('openai_free_user_daily_usage');
};
