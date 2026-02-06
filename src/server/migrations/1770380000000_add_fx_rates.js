exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('fx_rates', {
    pair: {
      type: 'text',
      primaryKey: true,
      notNull: true
    },
    rate: {
      type: 'double precision',
      notNull: true
    },
    as_of: {
      type: 'timestamptz',
      notNull: true
    },
    source: {
      type: 'text',
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
  pgm.dropTable('fx_rates');
};
