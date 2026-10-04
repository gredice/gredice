DO $migration$
DECLARE
	page_id integer;
	page_content text := $content$
{"sections":[{"component":"PageHeader","header":"Biljni susjedi","description":"Companion planting, odnosno sadnja biljnih susjeda, način je planiranja gredice u kojem se biljke slažu prema tome kako mogu pomagati, smetati ili neutralno rasti jedna uz drugu."},{"component":"TextBlock","tagline":"Osnove","header":"Što je companion planting?","description":"Kod planiranja gredice nije važno samo koliko mjesta biljka zauzima. Gledamo i vrijeme rasta, visinu, sjenu, mirise, oprašivače, potrebe za hranivima te moguće prenošenje bolesti ili štetnika. Dobar susjed može bolje iskoristiti prostor, privući korisne kukce, zbuniti neke štetnike ili jednostavno dobro pristajati u rasporedu."},{"component":"Feature1","tagline":"Kako čitati preporuke","header":"Tri signala, jedna odluka","description":"Biljni susjedi su pomoć pri izboru i razmještaju biljaka. Najkorisniji su kada ih kombiniraš s razmakom sadnje, svjetlom, vodom i sezonom.","features":[{"header":"Dobri susjedi","description":"Biljke koje se prema dostupnim izvorima i praktičnom planiranju često dobro slažu u blizini. To ne znači da moraju biti odmah jedna uz drugu, nego da ih vrijedi razmotriti u istom dijelu gredice."},{"header":"Izbjegavati blizinu","description":"Biljke kod kojih je bolje ostaviti razmak ili odabrati drugo polje. Razlog može biti natjecanje za prostor i hraniva, različit ritam rasta ili veći rizik od štetnika i bolesti."},{"header":"Neutralne kombinacije","description":"Ako biljke nisu označene kao dobri ili loši susjedi, to obično znači da nemamo dovoljno jasan signal. Tada prednost imaju sezona, razmak, dostupnost i vlastite želje."},{"header":"Kontekst gredice","description":"Ista kombinacija može se ponašati drugačije u sjeni, na jakom suncu, u zbijenom rasporedu ili uz drugačije zalijevanje. Biljni susjedi zato ne zamjenjuju promatranje gredice."}]},{"component":"CalloutBlock","tagline":"Napomena","header":"Nije strogo pravilo niti jamstvo prinosa","description":"Preporuke biljnih susjeda koristimo kao signal za planiranje, a ne kao obećanje da će kombinacija uvijek uspjeti. Tlo, vrijeme, njega, sorta i stanje biljke i dalje imaju veliku ulogu."},{"component":"MarkdownBlock","markdown":"## Primjeri u praksi\n\n- **Rajčica i bosiljak** često se prikazuju kao dobri susjedi jer se dobro uklapaju u isti ljetni ritam gredice.\n- **Mrkva i luk** mogu biti korisna kombinacija kada želiš miješati korjenasto povrće i lukovičaste biljke uz dovoljno razmaka.\n- **Komorač** se često odvaja od drugih kultura, pa ga u Gredicama prikazujemo kao biljku za oprezniji raspored.\n\n## Odakle dolaze podaci\n\nPodatke o biljnim susjedima slažemo iz javno dostupnih savjetodavnih tablica i izvora, zatim ih mapiramo na biljke koje postoje u Gredicama. Kada se izvori razilaze, radije ne prikazujemo par nego da ostavimo dojam lažne sigurnosti.\n\nKorisni izvori za kontekst:\n\n- [UF/IFAS Manatee County Extension companion planting chart](https://www.growables.org/informationVeg/documents/CompanionGuideUF.pdf)\n- [Virginia Cooperative Extension SPES-620P companion planting chart](https://www.pubs.ext.vt.edu/content/dam/pubs_ext_vt_edu/spes/spes-620/SPES-620.pdf)\n- [West Virginia University Extension companion planting guidance](https://extension.wvu.edu/lawn-gardening-pests/gardening/garden-management/companion-planting)\n- [University of Minnesota Extension companion planting context](https://extension.umn.edu/planting-and-growing-guides/companion-planting-home-gardens)"},{"component":"Faq1","tagline":"Pitanja","header":"Česta pitanja o biljnim susjedima","description":"Kratki odgovori za planiranje gredice bez pretjerivanja s pravilima.","features":[{"header":"Moram li uvijek saditi dobre susjede zajedno?","description":"Ne. Dobar susjed je prijedlog koji može pomoći pri rasporedu. Ako biljci više odgovara drugo mjesto zbog sunca, razmaka ili termina sadnje, taj kontekst ima prednost."},{"header":"Znači li loš susjed da biljke nikako ne smiju biti blizu?","description":"Ne nužno. To je signal za oprez. U maloj gredici često je dovoljno ostaviti razmak, ne saditi ih u isto polje ili ih razdvojiti drugom kulturom."},{"header":"Zašto neke biljke nemaju prikazane susjede?","description":"Za neke biljke nemamo dovoljno pouzdano mapirane podatke ili se izvori previše razilaze. Tada je bolje prikazati manje informacija nego sigurnije zvučati nego što podaci dopuštaju."},{"header":"Kako Gredice koriste ove podatke?","description":"Prikazujemo dobre i loše susjede na javnim stranicama biljaka te ih koristimo kao signal u vrtu kada biraš što posaditi pokraj postojećih biljaka."}]},{"component":"CtaBand","header":"Planiraš što posaditi sljedeće?","description":"Otvori katalog biljaka, provjeri dobre i loše susjede i složi gredicu prema sezoni, prostoru i vlastitom ukusu.","ctas":[{"label":"Pregledaj biljke","href":"/biljke"},{"label":"Vodič za prvu gredicu","href":"/vodic-za-prvu-gredicu","secondary":true}]}]}
$content$;
BEGIN
	SELECT "id"
	INTO page_id
	FROM "cms_pages"
	WHERE "slug" = 'biljni-susjedi' AND "is_deleted" = false
	LIMIT 1;

	IF page_id IS NULL THEN
		INSERT INTO "cms_pages" (
			"slug",
			"title",
			"content",
			"content_kind",
			"category",
			"tags",
			"state",
			"published_at",
			"meta_title",
			"meta_description",
			"meta_image_url",
			"seo_image_url",
			"canonical_path",
			"no_index",
			"created_at",
			"updated_at",
			"is_deleted"
		)
		VALUES (
			'biljni-susjedi',
			'Biljni susjedi',
			page_content,
			'page',
			NULL,
			ARRAY['Biljke', 'Planiranje gredice', 'Biljni susjedi'],
			'published',
			TIMESTAMP '2026-06-13 00:00:00',
			'Biljni susjedi i companion planting',
			'Što je companion planting, kako čitati dobre i loše biljne susjede te kako ih koristiti pri planiranju gredice.',
			NULL,
			NULL,
			'/biljni-susjedi',
			false,
			TIMESTAMP '2026-06-13 00:00:00',
			TIMESTAMP '2026-06-13 00:00:00',
			false
		)
		RETURNING "id" INTO page_id;

		INSERT INTO "cms_page_revisions" (
			"cms_page_id",
			"action",
			"actor_id",
			"actor_name",
			"next_slug",
			"next_title",
			"next_content",
			"next_content_kind",
			"next_category",
			"next_tags",
			"next_state",
			"next_meta_title",
			"next_meta_description",
			"next_meta_image_url",
			"next_seo_image_url",
			"next_canonical_path",
			"next_no_index",
			"next_published_at",
			"created_at"
		)
		VALUES (
			page_id,
			'cms_page.created',
			'source-cms-page-migration',
			'Source CMS page migration',
			'biljni-susjedi',
			'Biljni susjedi',
			page_content,
			'page',
			NULL,
			ARRAY['Biljke', 'Planiranje gredice', 'Biljni susjedi'],
			'published',
			'Biljni susjedi i companion planting',
			'Što je companion planting, kako čitati dobre i loše biljne susjede te kako ih koristiti pri planiranju gredice.',
			NULL,
			NULL,
			'/biljni-susjedi',
			false,
			TIMESTAMP '2026-06-13 00:00:00',
			TIMESTAMP '2026-06-13 00:00:00'
		);
	END IF;
END $migration$;
