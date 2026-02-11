exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    do $$
    begin
      if to_regclass('public.users') is null then
        raise exception 'saved_interfaces migration requires public.users to exist';
      end if;
    end
    $$;
  `);

  pgm.createTable('saved_interfaces', {
    id: {
      type: 'bigserial',
      primaryKey: true,
      notNull: true,
    },
    user_id: {
      type: 'bigint',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    client_interface_id: {
      type: 'text',
      notNull: true,
    },
    title: {
      type: 'text',
      notNull: true,
    },
    payload_version: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    payload_json: {
      type: 'jsonb',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('saved_interfaces', 'saved_interfaces_user_client_unique', {
    unique: ['user_id', 'client_interface_id'],
  });

  pgm.createIndex('saved_interfaces', ['user_id', { name: 'updated_at', sort: 'desc' }], {
    name: 'saved_interfaces_user_updated_idx',
  });

  pgm.createIndex('saved_interfaces', ['user_id', 'title'], {
    name: 'saved_interfaces_user_title_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('saved_interfaces', ['user_id', 'title'], {
    name: 'saved_interfaces_user_title_idx',
  });

  pgm.dropIndex('saved_interfaces', ['user_id', { name: 'updated_at', sort: 'desc' }], {
    name: 'saved_interfaces_user_updated_idx',
  });

  pgm.dropConstraint('saved_interfaces', 'saved_interfaces_user_client_unique');

  pgm.dropTable('saved_interfaces');
};
