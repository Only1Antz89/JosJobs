insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'authenticated', 'authenticated', 'leah@embercollective.co', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'authenticated', 'authenticated', 'harvey@harbourlive.co', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'authenticated', 'authenticated', 'nadia@novaoccasions.co', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'authenticated', 'authenticated', 'ava.morgan@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 'authenticated', 'authenticated', 'theo.carter@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', 'authenticated', 'authenticated', 'mia.wallace@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004', 'authenticated', 'authenticated', 'noah.reed@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005', 'authenticated', 'authenticated', 'ella.james@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb006', 'authenticated', 'authenticated', 'lucas.bennett@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb007', 'authenticated', 'authenticated', 'grace.patel@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb008', 'authenticated', 'authenticated', 'ethan.green@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb009', 'authenticated', 'authenticated', 'lily.adams@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb010', 'authenticated', 'authenticated', 'archie.scott@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb011', 'authenticated', 'authenticated', 'chloe.ross@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb012', 'authenticated', 'authenticated', 'freddie.hall@demo.staffbook.app', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false)
on conflict (id) do nothing;

insert into public.organizations (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Ember Collective', 'ember-collective'),
  ('22222222-2222-2222-2222-222222222222', 'Harbour Live', 'harbour-live'),
  ('33333333-3333-3333-3333-333333333333', 'Nova Occasions', 'nova-occasions')
on conflict (id) do nothing;

insert into public.profiles (id, role, full_name, email, company_name, bio, phone, skills, availability)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'organiser', 'Leah Thompson', 'leah@embercollective.co', 'Ember Collective', null, null, '{}', null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'organiser', 'Harvey Cole', 'harvey@harbourlive.co', 'Harbour Live', null, null, '{}', null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'organiser', 'Nadia Yusuf', 'nadia@novaoccasions.co', 'Nova Occasions', null, null, '{}', null),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'staff', 'Ava Morgan', 'ava.morgan@demo.staffbook.app', null, 'Reliable customer-facing events specialist.', '07123000001', '{"bar","guest management","VIP"}', 'Weekends + evenings'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 'staff', 'Theo Carter', 'theo.carter@demo.staffbook.app', null, 'Logistics and runner support with strong event pace.', '07123000002', '{"runner","logistics","retail"}', 'Flexible midweek'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', 'staff', 'Mia Wallace', 'mia.wallace@demo.staffbook.app', null, 'Registration and guest services specialist.', '07123000003', '{"reception","accreditation","guest services"}', 'Full-time freelance'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004', 'staff', 'Noah Reed', 'noah.reed@demo.staffbook.app', null, 'Stewarding and access control support.', '07123000004', '{"security support","access control","stewarding"}', 'Weekends + evenings'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005', 'staff', 'Ella James', 'ella.james@demo.staffbook.app', null, 'Quick bar service and premium guest handling.', '07123000005', '{"mixology","floor service","till"}', 'Flexible midweek'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb006', 'staff', 'Lucas Bennett', 'lucas.bennett@demo.staffbook.app', null, 'Production assistant and floor support.', '07123000006', '{"production assistant","set-up","logistics"}', 'Full-time freelance'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb007', 'staff', 'Grace Patel', 'grace.patel@demo.staffbook.app', null, 'Registration expert with calm check-in presence.', '07123000007', '{"registration","admin","hospitality"}', 'Flexible midweek'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb008', 'staff', 'Ethan Green', 'ethan.green@demo.staffbook.app', null, 'Retail and merch assistant with stock awareness.', '07123000008', '{"merch","customer support","stock"}', 'Weekends + evenings'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb009', 'staff', 'Lily Adams', 'lily.adams@demo.staffbook.app', null, 'Brand ambassador with strong lead capture.', '07123000009', '{"brand ambassador","sampling","lead capture"}', 'Full-time freelance'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb010', 'staff', 'Archie Scott', 'archie.scott@demo.staffbook.app', null, 'Queue management and stewarding support.', '07123000010', '{"stewarding","queue management","security support"}', 'Weekends + evenings'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb011', 'staff', 'Chloe Ross', 'chloe.ross@demo.staffbook.app', null, 'Conference host and front-of-house operator.', '07123000011', '{"conference host","microphone running","front-of-house"}', 'Flexible midweek'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb012', 'staff', 'Freddie Hall', 'freddie.hall@demo.staffbook.app', null, 'Barback and bartending support with fast close-down.', '07123000012', '{"barback","cellar","clean-down"}', 'Full-time freelance')
on conflict (id) do nothing;

insert into public.organization_memberships (id, organization_id, profile_id, role)
values
  ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'owner'),
  ('44444444-4444-4444-4444-444444444442', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'owner'),
  ('44444444-4444-4444-4444-444444444443', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'owner')
on conflict (id) do nothing;

insert into public.events (id, organization_id, created_by, title, description, location, event_date, event_type, required_roles, status)
values
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'London Rooftop Launch', 'Private product launch with VIP guests.', 'Shoreditch, London', now() + interval '10 day', 'Brand launch', '{"VIP host","Bartender","Runner"}', 'published'),
  ('55555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Investor Breakfast Briefing', 'Morning briefing with registration and hospitality.', 'Canary Wharf, London', now() + interval '3 day', 'Corporate', '{"Registration","Hospitality assistant"}', 'published'),
  ('55555555-5555-5555-5555-555555555553', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Harbour Summer Concert', 'Outdoor live event with merch and crowd support.', 'Brighton Seafront', now() + interval '14 day', 'Music', '{"Steward","Merch assistant","Guest services"}', 'published'),
  ('55555555-5555-5555-5555-555555555554', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Fashion Week Reception', 'Evening buyer and press reception.', 'Soho, London', now() - interval '12 day', 'Fashion', '{"Host","Bartender"}', 'completed'),
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Tech Expo Registration Hub', 'Registration and accreditation for two-day expo.', 'Manchester Central', now() + interval '6 day', 'Expo', '{"Registration","Accreditation","Floor support"}', 'published'),
  ('55555555-5555-5555-5555-555555555556', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Luxury Retail Pop-Up', 'Premium retail experience with brand ambassadors.', 'Birmingham', now() - interval '20 day', 'Retail', '{"Brand ambassador","Sales assistant"}', 'completed')
on conflict (id) do nothing;

insert into public.jobs (id, event_id, organization_id, created_by, title, description, role_type, shift_start, shift_end, pay_rate, positions_needed, status)
values
  ('66666666-6666-6666-6666-666666666661', '55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'VIP Host', 'Manage arrivals and premium guest flow.', 'VIP host', now() + interval '10 day', now() + interval '10 day 6 hour', 17, 3, 'open'),
  ('66666666-6666-6666-6666-666666666662', '55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Bartender', 'Cocktail and drinks service.', 'Bartender', now() + interval '10 day', now() + interval '10 day 6 hour', 18, 2, 'open'),
  ('66666666-6666-6666-6666-666666666663', '55555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Registration Assistant', 'Check-in and badge handoff.', 'Registration', now() + interval '3 day', now() + interval '3 day 5 hour', 15, 2, 'open'),
  ('66666666-6666-6666-6666-666666666664', '55555555-5555-5555-5555-555555555553', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Merch Assistant', 'Support merch stand and stock movement.', 'Merch', now() + interval '14 day', now() + interval '14 day 9 hour', 14, 4, 'open'),
  ('66666666-6666-6666-6666-666666666665', '55555555-5555-5555-5555-555555555553', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Steward', 'Crowd flow support and stewarding.', 'Steward', now() + interval '14 day', now() + interval '14 day 9 hour', 13, 6, 'open'),
  ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555554', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Reception Host', 'Front-of-house, accreditation, and buyer handling.', 'Host', now() - interval '12 day', now() - interval '12 day' + interval '6 hour', 16, 2, 'closed'),
  ('66666666-6666-6666-6666-666666666667', '55555555-5555-5555-5555-555555555554', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Evening Bartender', 'Bar service and close.', 'Bartender', now() - interval '12 day', now() - interval '12 day' + interval '6 hour', 18, 2, 'closed'),
  ('66666666-6666-6666-6666-666666666668', '55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Accreditation Lead', 'Badge printing and issue escalation.', 'Accreditation', now() + interval '6 day', now() + interval '6 day 10 hour', 16, 2, 'open'),
  ('66666666-6666-6666-6666-666666666669', '55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Expo Floor Support', 'Hall guidance and general assistance.', 'Floor support', now() + interval '6 day', now() + interval '6 day 8 hour', 14, 4, 'open'),
  ('66666666-6666-6666-6666-666666666670', '55555555-5555-5555-5555-555555555556', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Brand Ambassador', 'Premium sampling and lead capture.', 'Brand ambassador', now() - interval '20 day', now() - interval '20 day' + interval '8 hour', 15, 3, 'closed')
on conflict (id) do nothing;

insert into public.applications (id, job_id, staff_id, status, cover_note)
values
  ('77777777-7777-7777-7777-777777777771', '66666666-6666-6666-6666-666666666661', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'pending', 'Experienced with high-touch launches and guest list handling.'),
  ('77777777-7777-7777-7777-777777777772', '66666666-6666-6666-6666-666666666661', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', 'accepted', 'Confident VIP reception specialist.'),
  ('77777777-7777-7777-7777-777777777773', '66666666-6666-6666-6666-666666666662', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005', 'accepted', 'Strong cocktail service background.'),
  ('77777777-7777-7777-7777-777777777774', '66666666-6666-6666-6666-666666666663', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb007', 'pending', 'Registration and accreditation specialist.'),
  ('77777777-7777-7777-7777-777777777775', '66666666-6666-6666-6666-666666666664', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb008', 'pending', 'Retail and merch experience.'),
  ('77777777-7777-7777-7777-777777777776', '66666666-6666-6666-6666-666666666665', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb010', 'accepted', 'Large venue stewarding experience.'),
  ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb011', 'accepted', 'Strong front-of-house experience.'),
  ('77777777-7777-7777-7777-777777777778', '66666666-6666-6666-6666-666666666667', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb012', 'accepted', 'Fast service bartender with premium event experience.'),
  ('77777777-7777-7777-7777-777777777779', '66666666-6666-6666-6666-666666666668', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', 'pending', 'Accreditation and badge issuing experience.'),
  ('77777777-7777-7777-7777-777777777780', '66666666-6666-6666-6666-666666666669', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb006', 'pending', 'Production support for large events.'),
  ('77777777-7777-7777-7777-777777777781', '66666666-6666-6666-6666-666666666670', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb009', 'accepted', 'Brand ambassador with strong lead capture.'),
  ('77777777-7777-7777-7777-777777777782', '66666666-6666-6666-6666-666666666670', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'accepted', 'Confident product demo and guest engagement background.'),
  ('77777777-7777-7777-7777-777777777783', '66666666-6666-6666-6666-666666666670', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', 'accepted', 'Registration and guest services cover for the pop-up.')
on conflict (id) do nothing;

insert into public.ratings (
  id, event_id, job_id, organization_id, staff_id, organiser_id,
  reliability_score, professionalism_score, communication_score, customer_service_score, pressure_handling_score,
  overall_score, comment
)
values
  ('88888888-8888-8888-8888-888888888881', '55555555-5555-5555-5555-555555555554', '66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 5, 5, 5, 5, 5, 5.00, 'Fantastic with VIP arrivals and guest calm under pressure.'),
  ('88888888-8888-8888-8888-888888888882', '55555555-5555-5555-5555-555555555554', '66666666-6666-6666-6666-666666666667', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 4, 4, 4, 4, 4, 4.00, 'Solid bartender and reliable on close-down.'),
  ('88888888-8888-8888-8888-888888888883', '55555555-5555-5555-5555-555555555556', '66666666-6666-6666-6666-666666666670', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 5, 5, 5, 5, 5, 5.00, 'Confident seller, strong brand energy, delivered quality leads.'),
  ('88888888-8888-8888-8888-888888888884', '55555555-5555-5555-5555-555555555556', '66666666-6666-6666-6666-666666666670', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 4, 4, 4, 4, 4, 4.00, 'Professional and personable with customers all day.'),
  ('88888888-8888-8888-8888-888888888885', '55555555-5555-5555-5555-555555555556', '66666666-6666-6666-6666-666666666670', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 5, 5, 5, 5, 5, 5.00, 'Registration and guest handling were exceptional.')
on conflict (id) do nothing;
