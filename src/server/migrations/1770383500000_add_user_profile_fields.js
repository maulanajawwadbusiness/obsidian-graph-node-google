exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    alter table public.users
      add column if not exists display_name text;
  `);

  pgm.sql(`
    alter table public.users
      add column if not exists username text;
  `);

  pgm.sql(`
    create index if not exists users_username_idx on public.users (username);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    drop index if exists public.users_username_idx;
  `);

  pgm.sql(`
    alter table public.users
      drop column if exists username;
  `);

  pgm.sql(`
    alter table public.users
      drop column if exists display_name;
  `);
};
