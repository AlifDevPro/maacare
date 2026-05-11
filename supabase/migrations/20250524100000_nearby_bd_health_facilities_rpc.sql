-- Nearest facilities by Haversine distance (km). Tags match lower(amenity) or lower(healthcare).

create or replace function public.nearby_bd_health_facilities(
  p_lat double precision,
  p_lng double precision,
  p_tags text[] default null,
  p_limit int default 20
)
returns table (
  osm_id text,
  name text,
  amenity text,
  healthcare text,
  addr_full text,
  addr_city text,
  adm2_name text,
  adm3_name text,
  adm4_name text,
  latitude double precision,
  longitude double precision,
  distance_km double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    f.osm_id,
    f.name,
    f.amenity,
    f.healthcare,
    f.addr_full,
    f.addr_city,
    f.adm2_name,
    f.adm3_name,
    f.adm4_name,
    f.latitude,
    f.longitude,
    (
      6371.0 * acos(
        least(
          1::double precision,
          greatest(
            -1::double precision,
            cos(radians(p_lat)) * cos(radians(f.latitude))
              * cos(radians(f.longitude) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(f.latitude))
          )
        )
      )
    )::double precision as distance_km
  from public.bd_health_facilities f
  where
    p_tags is null
    or cardinality(p_tags) = 0
    or lower(coalesce(f.amenity, '')) = any (array(select lower(trim(t)) from unnest(p_tags) as t where trim(t) <> ''))
    or lower(coalesce(f.healthcare, '')) = any (array(select lower(trim(t)) from unnest(p_tags) as t where trim(t) <> ''))
  order by distance_km asc nulls last
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

comment on function public.nearby_bd_health_facilities(double precision, double precision, text[], int) is
  'Returns BD health facilities sorted by distance; filter by OSM amenity/healthcare tags (e.g. hospital, pharmacy).';

grant execute on function public.nearby_bd_health_facilities(double precision, double precision, text[], int)
  to authenticated;
