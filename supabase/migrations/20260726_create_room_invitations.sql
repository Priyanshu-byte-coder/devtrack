create table room_invitations (
    id uuid primary key default gen_random_uuid(),
    room_id uuid references collaboration_rooms(id) on delete cascade,
    github_username text not null,
    invited_by text not null,
    status text not null default 'pending',
    created_at timestamptz default now(),
    responded_at timestamptz
);

create unique index room_invitation_unique
on room_invitations(room_id, github_username)
where status = 'pending';