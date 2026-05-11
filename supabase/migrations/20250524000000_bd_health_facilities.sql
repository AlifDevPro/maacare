-- Bangladesh health facilities (OSM-style GeoJSON features).
-- geometry.coordinates are GeoJSON order: [longitude, latitude].

create table if not exists public.bd_health_facilities (
  osm_id text primary key,
  name text not null,
  name_en text,
  name_bn text,
  name_latin text,
  amenity text,
  healthcare text,
  healthcare_speciality text,
  building text,
  operator_type text,
  capacity_persons text,
  addr_full text,
  addr_city text,
  source text,
  adm0_pcode text,
  adm0_name text,
  adm1_pcode text,
  adm1_name text,
  adm2_pcode text,
  adm2_name text,
  adm3_pcode text,
  adm3_name text,
  adm4_pcode text,
  adm4_name text,
  longitude double precision not null,
  latitude double precision not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.bd_health_facilities is
  'Point facilities from GeoJSON FeatureCollection (amenity/healthcare tags); coordinates stored as lon/lat.';

create index if not exists bd_health_facilities_amenity_idx
  on public.bd_health_facilities (amenity);

create index if not exists bd_health_facilities_healthcare_idx
  on public.bd_health_facilities (healthcare);

create index if not exists bd_health_facilities_adm2_idx
  on public.bd_health_facilities (adm2_pcode);

create index if not exists bd_health_facilities_lat_lon_idx
  on public.bd_health_facilities (latitude, longitude);

alter table public.bd_health_facilities enable row level security;

-- Reference data: any signed-in user can read (matches emergency API auth).
create policy bd_health_facilities_select_authenticated
  on public.bd_health_facilities
  for select
  to authenticated
  using (true);
