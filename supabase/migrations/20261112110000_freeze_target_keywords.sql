-- P1-01 phase 2. New append-only planning versions and per-discovery bindings.
-- No historical settings, source snapshots or report evidence are rewritten.
begin;

-- Same pinned Unicode case folding as report-v22/generated/normalization-data.json.
create function public.v22_target_keyword_casefold(p text) returns text
language sql immutable strict set search_path=public as $function$
 select coalesce(string_agg(coalesce(('{"A":"a","B":"b","C":"c","D":"d","E":"e","F":"f","G":"g","H":"h","I":"i","J":"j","K":"k","L":"l","M":"m","N":"n","O":"o","P":"p","Q":"q","R":"r","S":"s","T":"t","U":"u","V":"v","W":"w","X":"x","Y":"y","Z":"z","µ":"μ","À":"à","Á":"á","Â":"â","Ã":"ã","Ä":"ä","Å":"å","Æ":"æ","Ç":"ç","È":"è","É":"é","Ê":"ê","Ë":"ë","Ì":"ì","Í":"í","Î":"î","Ï":"ï","Ð":"ð","Ñ":"ñ","Ò":"ò","Ó":"ó","Ô":"ô","Õ":"õ","Ö":"ö","Ø":"ø","Ù":"ù","Ú":"ú","Û":"û","Ü":"ü","Ý":"ý","Þ":"þ","ß":"ss","Ā":"ā","Ă":"ă","Ą":"ą","Ć":"ć","Ĉ":"ĉ","Ċ":"ċ","Č":"č","Ď":"ď","Đ":"đ","Ē":"ē","Ĕ":"ĕ","Ė":"ė","Ę":"ę","Ě":"ě","Ĝ":"ĝ","Ğ":"ğ","Ġ":"ġ","Ģ":"ģ","Ĥ":"ĥ","Ħ":"ħ","Ĩ":"ĩ","Ī":"ī","Ĭ":"ĭ","Į":"į","İ":"i̇","Ĳ":"ĳ","Ĵ":"ĵ","Ķ":"ķ","Ĺ":"ĺ","Ļ":"ļ","Ľ":"ľ","Ŀ":"ŀ","Ł":"ł","Ń":"ń","Ņ":"ņ","Ň":"ň","ŉ":"ʼn","Ŋ":"ŋ","Ō":"ō","Ŏ":"ŏ","Ő":"ő","Œ":"œ","Ŕ":"ŕ","Ŗ":"ŗ","Ř":"ř","Ś":"ś","Ŝ":"ŝ","Ş":"ş","Š":"š","Ţ":"ţ","Ť":"ť","Ŧ":"ŧ","Ũ":"ũ","Ū":"ū","Ŭ":"ŭ","Ů":"ů","Ű":"ű","Ų":"ų","Ŵ":"ŵ","Ŷ":"ŷ","Ÿ":"ÿ","Ź":"ź","Ż":"ż","Ž":"ž","ſ":"s","Ɓ":"ɓ","Ƃ":"ƃ","Ƅ":"ƅ","Ɔ":"ɔ","Ƈ":"ƈ","Ɖ":"ɖ","Ɗ":"ɗ","Ƌ":"ƌ","Ǝ":"ǝ","Ə":"ə","Ɛ":"ɛ","Ƒ":"ƒ","Ɠ":"ɠ","Ɣ":"ɣ","Ɩ":"ɩ","Ɨ":"ɨ","Ƙ":"ƙ","Ɯ":"ɯ","Ɲ":"ɲ","Ɵ":"ɵ","Ơ":"ơ","Ƣ":"ƣ","Ƥ":"ƥ","Ʀ":"ʀ","Ƨ":"ƨ","Ʃ":"ʃ","Ƭ":"ƭ","Ʈ":"ʈ","Ư":"ư","Ʊ":"ʊ","Ʋ":"ʋ","Ƴ":"ƴ","Ƶ":"ƶ","Ʒ":"ʒ","Ƹ":"ƹ","Ƽ":"ƽ","Ǆ":"ǆ","ǅ":"ǆ","Ǉ":"ǉ","ǈ":"ǉ","Ǌ":"ǌ","ǋ":"ǌ","Ǎ":"ǎ","Ǐ":"ǐ","Ǒ":"ǒ","Ǔ":"ǔ","Ǖ":"ǖ","Ǘ":"ǘ","Ǚ":"ǚ","Ǜ":"ǜ","Ǟ":"ǟ","Ǡ":"ǡ","Ǣ":"ǣ","Ǥ":"ǥ","Ǧ":"ǧ","Ǩ":"ǩ","Ǫ":"ǫ","Ǭ":"ǭ","Ǯ":"ǯ","ǰ":"ǰ","Ǳ":"ǳ","ǲ":"ǳ","Ǵ":"ǵ","Ƕ":"ƕ","Ƿ":"ƿ","Ǹ":"ǹ","Ǻ":"ǻ","Ǽ":"ǽ","Ǿ":"ǿ","Ȁ":"ȁ","Ȃ":"ȃ","Ȅ":"ȅ","Ȇ":"ȇ","Ȉ":"ȉ","Ȋ":"ȋ","Ȍ":"ȍ","Ȏ":"ȏ","Ȑ":"ȑ","Ȓ":"ȓ","Ȕ":"ȕ","Ȗ":"ȗ","Ș":"ș","Ț":"ț","Ȝ":"ȝ","Ȟ":"ȟ","Ƞ":"ƞ","Ȣ":"ȣ","Ȥ":"ȥ","Ȧ":"ȧ","Ȩ":"ȩ","Ȫ":"ȫ","Ȭ":"ȭ","Ȯ":"ȯ","Ȱ":"ȱ","Ȳ":"ȳ","Ⱥ":"ⱥ","Ȼ":"ȼ","Ƚ":"ƚ","Ⱦ":"ⱦ","Ɂ":"ɂ","Ƀ":"ƀ","Ʉ":"ʉ","Ʌ":"ʌ","Ɇ":"ɇ","Ɉ":"ɉ","Ɋ":"ɋ","Ɍ":"ɍ","Ɏ":"ɏ","ͅ":"ι","Ͱ":"ͱ","Ͳ":"ͳ","Ͷ":"ͷ","Ϳ":"ϳ","Ά":"ά","Έ":"έ","Ή":"ή","Ί":"ί","Ό":"ό","Ύ":"ύ","Ώ":"ώ","ΐ":"ΐ","Α":"α","Β":"β","Γ":"γ","Δ":"δ","Ε":"ε","Ζ":"ζ","Η":"η","Θ":"θ","Ι":"ι","Κ":"κ","Λ":"λ","Μ":"μ","Ν":"ν","Ξ":"ξ","Ο":"ο","Π":"π","Ρ":"ρ","Σ":"σ","Τ":"τ","Υ":"υ","Φ":"φ","Χ":"χ","Ψ":"ψ","Ω":"ω","Ϊ":"ϊ","Ϋ":"ϋ","ΰ":"ΰ","ς":"σ","Ϗ":"ϗ","ϐ":"β","ϑ":"θ","ϕ":"φ","ϖ":"π","Ϙ":"ϙ","Ϛ":"ϛ","Ϝ":"ϝ","Ϟ":"ϟ","Ϡ":"ϡ","Ϣ":"ϣ","Ϥ":"ϥ","Ϧ":"ϧ","Ϩ":"ϩ","Ϫ":"ϫ","Ϭ":"ϭ","Ϯ":"ϯ","ϰ":"κ","ϱ":"ρ","ϴ":"θ","ϵ":"ε","Ϸ":"ϸ","Ϲ":"ϲ","Ϻ":"ϻ","Ͻ":"ͻ","Ͼ":"ͼ","Ͽ":"ͽ","Ѐ":"ѐ","Ё":"ё","Ђ":"ђ","Ѓ":"ѓ","Є":"є","Ѕ":"ѕ","І":"і","Ї":"ї","Ј":"ј","Љ":"љ","Њ":"њ","Ћ":"ћ","Ќ":"ќ","Ѝ":"ѝ","Ў":"ў","Џ":"џ","А":"а","Б":"б","В":"в","Г":"г","Д":"д","Е":"е","Ж":"ж","З":"з","И":"и","Й":"й","К":"к","Л":"л","М":"м","Н":"н","О":"о","П":"п","Р":"р","С":"с","Т":"т","У":"у","Ф":"ф","Х":"х","Ц":"ц","Ч":"ч","Ш":"ш","Щ":"щ","Ъ":"ъ","Ы":"ы","Ь":"ь","Э":"э","Ю":"ю","Я":"я","Ѡ":"ѡ","Ѣ":"ѣ","Ѥ":"ѥ","Ѧ":"ѧ","Ѩ":"ѩ","Ѫ":"ѫ","Ѭ":"ѭ","Ѯ":"ѯ","Ѱ":"ѱ","Ѳ":"ѳ","Ѵ":"ѵ","Ѷ":"ѷ","Ѹ":"ѹ","Ѻ":"ѻ","Ѽ":"ѽ","Ѿ":"ѿ","Ҁ":"ҁ","Ҋ":"ҋ","Ҍ":"ҍ","Ҏ":"ҏ","Ґ":"ґ","Ғ":"ғ","Ҕ":"ҕ","Җ":"җ","Ҙ":"ҙ","Қ":"қ","Ҝ":"ҝ","Ҟ":"ҟ","Ҡ":"ҡ","Ң":"ң","Ҥ":"ҥ","Ҧ":"ҧ","Ҩ":"ҩ","Ҫ":"ҫ","Ҭ":"ҭ","Ү":"ү","Ұ":"ұ","Ҳ":"ҳ","Ҵ":"ҵ","Ҷ":"ҷ","Ҹ":"ҹ","Һ":"һ","Ҽ":"ҽ","Ҿ":"ҿ","Ӏ":"ӏ","Ӂ":"ӂ","Ӄ":"ӄ","Ӆ":"ӆ","Ӈ":"ӈ","Ӊ":"ӊ","Ӌ":"ӌ","Ӎ":"ӎ","Ӑ":"ӑ","Ӓ":"ӓ","Ӕ":"ӕ","Ӗ":"ӗ","Ә":"ә","Ӛ":"ӛ","Ӝ":"ӝ","Ӟ":"ӟ","Ӡ":"ӡ","Ӣ":"ӣ","Ӥ":"ӥ","Ӧ":"ӧ","Ө":"ө","Ӫ":"ӫ","Ӭ":"ӭ","Ӯ":"ӯ","Ӱ":"ӱ","Ӳ":"ӳ","Ӵ":"ӵ","Ӷ":"ӷ","Ӹ":"ӹ","Ӻ":"ӻ","Ӽ":"ӽ","Ӿ":"ӿ","Ԁ":"ԁ","Ԃ":"ԃ","Ԅ":"ԅ","Ԇ":"ԇ","Ԉ":"ԉ","Ԋ":"ԋ","Ԍ":"ԍ","Ԏ":"ԏ","Ԑ":"ԑ","Ԓ":"ԓ","Ԕ":"ԕ","Ԗ":"ԗ","Ԙ":"ԙ","Ԛ":"ԛ","Ԝ":"ԝ","Ԟ":"ԟ","Ԡ":"ԡ","Ԣ":"ԣ","Ԥ":"ԥ","Ԧ":"ԧ","Ԩ":"ԩ","Ԫ":"ԫ","Ԭ":"ԭ","Ԯ":"ԯ","Ա":"ա","Բ":"բ","Գ":"գ","Դ":"դ","Ե":"ե","Զ":"զ","Է":"է","Ը":"ը","Թ":"թ","Ժ":"ժ","Ի":"ի","Լ":"լ","Խ":"խ","Ծ":"ծ","Կ":"կ","Հ":"հ","Ձ":"ձ","Ղ":"ղ","Ճ":"ճ","Մ":"մ","Յ":"յ","Ն":"ն","Շ":"շ","Ո":"ո","Չ":"չ","Պ":"պ","Ջ":"ջ","Ռ":"ռ","Ս":"ս","Վ":"վ","Տ":"տ","Ր":"ր","Ց":"ց","Ւ":"ւ","Փ":"փ","Ք":"ք","Օ":"օ","Ֆ":"ֆ","և":"եւ","Ⴀ":"ⴀ","Ⴁ":"ⴁ","Ⴂ":"ⴂ","Ⴃ":"ⴃ","Ⴄ":"ⴄ","Ⴅ":"ⴅ","Ⴆ":"ⴆ","Ⴇ":"ⴇ","Ⴈ":"ⴈ","Ⴉ":"ⴉ","Ⴊ":"ⴊ","Ⴋ":"ⴋ","Ⴌ":"ⴌ","Ⴍ":"ⴍ","Ⴎ":"ⴎ","Ⴏ":"ⴏ","Ⴐ":"ⴐ","Ⴑ":"ⴑ","Ⴒ":"ⴒ","Ⴓ":"ⴓ","Ⴔ":"ⴔ","Ⴕ":"ⴕ","Ⴖ":"ⴖ","Ⴗ":"ⴗ","Ⴘ":"ⴘ","Ⴙ":"ⴙ","Ⴚ":"ⴚ","Ⴛ":"ⴛ","Ⴜ":"ⴜ","Ⴝ":"ⴝ","Ⴞ":"ⴞ","Ⴟ":"ⴟ","Ⴠ":"ⴠ","Ⴡ":"ⴡ","Ⴢ":"ⴢ","Ⴣ":"ⴣ","Ⴤ":"ⴤ","Ⴥ":"ⴥ","Ⴧ":"ⴧ","Ⴭ":"ⴭ","ᏸ":"Ᏸ","ᏹ":"Ᏹ","ᏺ":"Ᏺ","ᏻ":"Ᏻ","ᏼ":"Ᏼ","ᏽ":"Ᏽ","ᲀ":"в","ᲁ":"д","ᲂ":"о","ᲃ":"с","ᲄ":"т","ᲅ":"т","ᲆ":"ъ","ᲇ":"ѣ","ᲈ":"ꙋ","Ა":"ა","Ბ":"ბ","Გ":"გ","Დ":"დ","Ე":"ე","Ვ":"ვ","Ზ":"ზ","Თ":"თ","Ი":"ი","Კ":"კ","Ლ":"ლ","Მ":"მ","Ნ":"ნ","Ო":"ო","Პ":"პ","Ჟ":"ჟ","Რ":"რ","Ს":"ს","Ტ":"ტ","Უ":"უ","Ფ":"ფ","Ქ":"ქ","Ღ":"ღ","Ყ":"ყ","Შ":"შ","Ჩ":"ჩ","Ც":"ც","Ძ":"ძ","Წ":"წ","Ჭ":"ჭ","Ხ":"ხ","Ჯ":"ჯ","Ჰ":"ჰ","Ჱ":"ჱ","Ჲ":"ჲ","Ჳ":"ჳ","Ჴ":"ჴ","Ჵ":"ჵ","Ჶ":"ჶ","Ჷ":"ჷ","Ჸ":"ჸ","Ჹ":"ჹ","Ჺ":"ჺ","Ჽ":"ჽ","Ჾ":"ჾ","Ჿ":"ჿ","Ḁ":"ḁ","Ḃ":"ḃ","Ḅ":"ḅ","Ḇ":"ḇ","Ḉ":"ḉ","Ḋ":"ḋ","Ḍ":"ḍ","Ḏ":"ḏ","Ḑ":"ḑ","Ḓ":"ḓ","Ḕ":"ḕ","Ḗ":"ḗ","Ḙ":"ḙ","Ḛ":"ḛ","Ḝ":"ḝ","Ḟ":"ḟ","Ḡ":"ḡ","Ḣ":"ḣ","Ḥ":"ḥ","Ḧ":"ḧ","Ḩ":"ḩ","Ḫ":"ḫ","Ḭ":"ḭ","Ḯ":"ḯ","Ḱ":"ḱ","Ḳ":"ḳ","Ḵ":"ḵ","Ḷ":"ḷ","Ḹ":"ḹ","Ḻ":"ḻ","Ḽ":"ḽ","Ḿ":"ḿ","Ṁ":"ṁ","Ṃ":"ṃ","Ṅ":"ṅ","Ṇ":"ṇ","Ṉ":"ṉ","Ṋ":"ṋ","Ṍ":"ṍ","Ṏ":"ṏ","Ṑ":"ṑ","Ṓ":"ṓ","Ṕ":"ṕ","Ṗ":"ṗ","Ṙ":"ṙ","Ṛ":"ṛ","Ṝ":"ṝ","Ṟ":"ṟ","Ṡ":"ṡ","Ṣ":"ṣ","Ṥ":"ṥ","Ṧ":"ṧ","Ṩ":"ṩ","Ṫ":"ṫ","Ṭ":"ṭ","Ṯ":"ṯ","Ṱ":"ṱ","Ṳ":"ṳ","Ṵ":"ṵ","Ṷ":"ṷ","Ṹ":"ṹ","Ṻ":"ṻ","Ṽ":"ṽ","Ṿ":"ṿ","Ẁ":"ẁ","Ẃ":"ẃ","Ẅ":"ẅ","Ẇ":"ẇ","Ẉ":"ẉ","Ẋ":"ẋ","Ẍ":"ẍ","Ẏ":"ẏ","Ẑ":"ẑ","Ẓ":"ẓ","Ẕ":"ẕ","ẖ":"ẖ","ẗ":"ẗ","ẘ":"ẘ","ẙ":"ẙ","ẚ":"aʾ","ẛ":"ṡ","ẞ":"ss","Ạ":"ạ","Ả":"ả","Ấ":"ấ","Ầ":"ầ","Ẩ":"ẩ","Ẫ":"ẫ","Ậ":"ậ","Ắ":"ắ","Ằ":"ằ","Ẳ":"ẳ","Ẵ":"ẵ","Ặ":"ặ","Ẹ":"ẹ","Ẻ":"ẻ","Ẽ":"ẽ","Ế":"ế","Ề":"ề","Ể":"ể","Ễ":"ễ","Ệ":"ệ","Ỉ":"ỉ","Ị":"ị","Ọ":"ọ","Ỏ":"ỏ","Ố":"ố","Ồ":"ồ","Ổ":"ổ","Ỗ":"ỗ","Ộ":"ộ","Ớ":"ớ","Ờ":"ờ","Ở":"ở","Ỡ":"ỡ","Ợ":"ợ","Ụ":"ụ","Ủ":"ủ","Ứ":"ứ","Ừ":"ừ","Ử":"ử","Ữ":"ữ","Ự":"ự","Ỳ":"ỳ","Ỵ":"ỵ","Ỷ":"ỷ","Ỹ":"ỹ","Ỻ":"ỻ","Ỽ":"ỽ","Ỿ":"ỿ","Ἀ":"ἀ","Ἁ":"ἁ","Ἂ":"ἂ","Ἃ":"ἃ","Ἄ":"ἄ","Ἅ":"ἅ","Ἆ":"ἆ","Ἇ":"ἇ","Ἐ":"ἐ","Ἑ":"ἑ","Ἒ":"ἒ","Ἓ":"ἓ","Ἔ":"ἔ","Ἕ":"ἕ","Ἠ":"ἠ","Ἡ":"ἡ","Ἢ":"ἢ","Ἣ":"ἣ","Ἤ":"ἤ","Ἥ":"ἥ","Ἦ":"ἦ","Ἧ":"ἧ","Ἰ":"ἰ","Ἱ":"ἱ","Ἲ":"ἲ","Ἳ":"ἳ","Ἴ":"ἴ","Ἵ":"ἵ","Ἶ":"ἶ","Ἷ":"ἷ","Ὀ":"ὀ","Ὁ":"ὁ","Ὂ":"ὂ","Ὃ":"ὃ","Ὄ":"ὄ","Ὅ":"ὅ","ὐ":"ὐ","ὒ":"ὒ","ὔ":"ὔ","ὖ":"ὖ","Ὑ":"ὑ","Ὓ":"ὓ","Ὕ":"ὕ","Ὗ":"ὗ","Ὠ":"ὠ","Ὡ":"ὡ","Ὢ":"ὢ","Ὣ":"ὣ","Ὤ":"ὤ","Ὥ":"ὥ","Ὦ":"ὦ","Ὧ":"ὧ","ᾀ":"ἀι","ᾁ":"ἁι","ᾂ":"ἂι","ᾃ":"ἃι","ᾄ":"ἄι","ᾅ":"ἅι","ᾆ":"ἆι","ᾇ":"ἇι","ᾈ":"ἀι","ᾉ":"ἁι","ᾊ":"ἂι","ᾋ":"ἃι","ᾌ":"ἄι","ᾍ":"ἅι","ᾎ":"ἆι","ᾏ":"ἇι","ᾐ":"ἠι","ᾑ":"ἡι","ᾒ":"ἢι","ᾓ":"ἣι","ᾔ":"ἤι","ᾕ":"ἥι","ᾖ":"ἦι","ᾗ":"ἧι","ᾘ":"ἠι","ᾙ":"ἡι","ᾚ":"ἢι","ᾛ":"ἣι","ᾜ":"ἤι","ᾝ":"ἥι","ᾞ":"ἦι","ᾟ":"ἧι","ᾠ":"ὠι","ᾡ":"ὡι","ᾢ":"ὢι","ᾣ":"ὣι","ᾤ":"ὤι","ᾥ":"ὥι","ᾦ":"ὦι","ᾧ":"ὧι","ᾨ":"ὠι","ᾩ":"ὡι","ᾪ":"ὢι","ᾫ":"ὣι","ᾬ":"ὤι","ᾭ":"ὥι","ᾮ":"ὦι","ᾯ":"ὧι","ᾲ":"ὰι","ᾳ":"αι","ᾴ":"άι","ᾶ":"ᾶ","ᾷ":"ᾶι","Ᾰ":"ᾰ","Ᾱ":"ᾱ","Ὰ":"ὰ","Ά":"ά","ᾼ":"αι","ι":"ι","ῂ":"ὴι","ῃ":"ηι","ῄ":"ήι","ῆ":"ῆ","ῇ":"ῆι","Ὲ":"ὲ","Έ":"έ","Ὴ":"ὴ","Ή":"ή","ῌ":"ηι","ῒ":"ῒ","ΐ":"ΐ","ῖ":"ῖ","ῗ":"ῗ","Ῐ":"ῐ","Ῑ":"ῑ","Ὶ":"ὶ","Ί":"ί","ῢ":"ῢ","ΰ":"ΰ","ῤ":"ῤ","ῦ":"ῦ","ῧ":"ῧ","Ῠ":"ῠ","Ῡ":"ῡ","Ὺ":"ὺ","Ύ":"ύ","Ῥ":"ῥ","ῲ":"ὼι","ῳ":"ωι","ῴ":"ώι","ῶ":"ῶ","ῷ":"ῶι","Ὸ":"ὸ","Ό":"ό","Ὼ":"ὼ","Ώ":"ώ","ῼ":"ωι","Ω":"ω","K":"k","Å":"å","Ⅎ":"ⅎ","Ⅰ":"ⅰ","Ⅱ":"ⅱ","Ⅲ":"ⅲ","Ⅳ":"ⅳ","Ⅴ":"ⅴ","Ⅵ":"ⅵ","Ⅶ":"ⅶ","Ⅷ":"ⅷ","Ⅸ":"ⅸ","Ⅹ":"ⅹ","Ⅺ":"ⅺ","Ⅻ":"ⅻ","Ⅼ":"ⅼ","Ⅽ":"ⅽ","Ⅾ":"ⅾ","Ⅿ":"ⅿ","Ↄ":"ↄ","Ⓐ":"ⓐ","Ⓑ":"ⓑ","Ⓒ":"ⓒ","Ⓓ":"ⓓ","Ⓔ":"ⓔ","Ⓕ":"ⓕ","Ⓖ":"ⓖ","Ⓗ":"ⓗ","Ⓘ":"ⓘ","Ⓙ":"ⓙ","Ⓚ":"ⓚ","Ⓛ":"ⓛ","Ⓜ":"ⓜ","Ⓝ":"ⓝ","Ⓞ":"ⓞ","Ⓟ":"ⓟ","Ⓠ":"ⓠ","Ⓡ":"ⓡ","Ⓢ":"ⓢ","Ⓣ":"ⓣ","Ⓤ":"ⓤ","Ⓥ":"ⓥ","Ⓦ":"ⓦ","Ⓧ":"ⓧ","Ⓨ":"ⓨ","Ⓩ":"ⓩ","Ⰰ":"ⰰ","Ⰱ":"ⰱ","Ⰲ":"ⰲ","Ⰳ":"ⰳ","Ⰴ":"ⰴ","Ⰵ":"ⰵ","Ⰶ":"ⰶ","Ⰷ":"ⰷ","Ⰸ":"ⰸ","Ⰹ":"ⰹ","Ⰺ":"ⰺ","Ⰻ":"ⰻ","Ⰼ":"ⰼ","Ⰽ":"ⰽ","Ⰾ":"ⰾ","Ⰿ":"ⰿ","Ⱀ":"ⱀ","Ⱁ":"ⱁ","Ⱂ":"ⱂ","Ⱃ":"ⱃ","Ⱄ":"ⱄ","Ⱅ":"ⱅ","Ⱆ":"ⱆ","Ⱇ":"ⱇ","Ⱈ":"ⱈ","Ⱉ":"ⱉ","Ⱊ":"ⱊ","Ⱋ":"ⱋ","Ⱌ":"ⱌ","Ⱍ":"ⱍ","Ⱎ":"ⱎ","Ⱏ":"ⱏ","Ⱐ":"ⱐ","Ⱑ":"ⱑ","Ⱒ":"ⱒ","Ⱓ":"ⱓ","Ⱔ":"ⱔ","Ⱕ":"ⱕ","Ⱖ":"ⱖ","Ⱗ":"ⱗ","Ⱘ":"ⱘ","Ⱙ":"ⱙ","Ⱚ":"ⱚ","Ⱛ":"ⱛ","Ⱜ":"ⱜ","Ⱝ":"ⱝ","Ⱞ":"ⱞ","Ⱟ":"ⱟ","Ⱡ":"ⱡ","Ɫ":"ɫ","Ᵽ":"ᵽ","Ɽ":"ɽ","Ⱨ":"ⱨ","Ⱪ":"ⱪ","Ⱬ":"ⱬ","Ɑ":"ɑ","Ɱ":"ɱ","Ɐ":"ɐ","Ɒ":"ɒ","Ⱳ":"ⱳ","Ⱶ":"ⱶ","Ȿ":"ȿ","Ɀ":"ɀ","Ⲁ":"ⲁ","Ⲃ":"ⲃ","Ⲅ":"ⲅ","Ⲇ":"ⲇ","Ⲉ":"ⲉ","Ⲋ":"ⲋ","Ⲍ":"ⲍ","Ⲏ":"ⲏ","Ⲑ":"ⲑ","Ⲓ":"ⲓ","Ⲕ":"ⲕ","Ⲗ":"ⲗ","Ⲙ":"ⲙ","Ⲛ":"ⲛ","Ⲝ":"ⲝ","Ⲟ":"ⲟ","Ⲡ":"ⲡ","Ⲣ":"ⲣ","Ⲥ":"ⲥ","Ⲧ":"ⲧ","Ⲩ":"ⲩ","Ⲫ":"ⲫ","Ⲭ":"ⲭ","Ⲯ":"ⲯ","Ⲱ":"ⲱ","Ⲳ":"ⲳ","Ⲵ":"ⲵ","Ⲷ":"ⲷ","Ⲹ":"ⲹ","Ⲻ":"ⲻ","Ⲽ":"ⲽ","Ⲿ":"ⲿ","Ⳁ":"ⳁ","Ⳃ":"ⳃ","Ⳅ":"ⳅ","Ⳇ":"ⳇ","Ⳉ":"ⳉ","Ⳋ":"ⳋ","Ⳍ":"ⳍ","Ⳏ":"ⳏ","Ⳑ":"ⳑ","Ⳓ":"ⳓ","Ⳕ":"ⳕ","Ⳗ":"ⳗ","Ⳙ":"ⳙ","Ⳛ":"ⳛ","Ⳝ":"ⳝ","Ⳟ":"ⳟ","Ⳡ":"ⳡ","Ⳣ":"ⳣ","Ⳬ":"ⳬ","Ⳮ":"ⳮ","Ⳳ":"ⳳ","Ꙁ":"ꙁ","Ꙃ":"ꙃ","Ꙅ":"ꙅ","Ꙇ":"ꙇ","Ꙉ":"ꙉ","Ꙋ":"ꙋ","Ꙍ":"ꙍ","Ꙏ":"ꙏ","Ꙑ":"ꙑ","Ꙓ":"ꙓ","Ꙕ":"ꙕ","Ꙗ":"ꙗ","Ꙙ":"ꙙ","Ꙛ":"ꙛ","Ꙝ":"ꙝ","Ꙟ":"ꙟ","Ꙡ":"ꙡ","Ꙣ":"ꙣ","Ꙥ":"ꙥ","Ꙧ":"ꙧ","Ꙩ":"ꙩ","Ꙫ":"ꙫ","Ꙭ":"ꙭ","Ꚁ":"ꚁ","Ꚃ":"ꚃ","Ꚅ":"ꚅ","Ꚇ":"ꚇ","Ꚉ":"ꚉ","Ꚋ":"ꚋ","Ꚍ":"ꚍ","Ꚏ":"ꚏ","Ꚑ":"ꚑ","Ꚓ":"ꚓ","Ꚕ":"ꚕ","Ꚗ":"ꚗ","Ꚙ":"ꚙ","Ꚛ":"ꚛ","Ꜣ":"ꜣ","Ꜥ":"ꜥ","Ꜧ":"ꜧ","Ꜩ":"ꜩ","Ꜫ":"ꜫ","Ꜭ":"ꜭ","Ꜯ":"ꜯ","Ꜳ":"ꜳ","Ꜵ":"ꜵ","Ꜷ":"ꜷ","Ꜹ":"ꜹ","Ꜻ":"ꜻ","Ꜽ":"ꜽ","Ꜿ":"ꜿ","Ꝁ":"ꝁ","Ꝃ":"ꝃ","Ꝅ":"ꝅ","Ꝇ":"ꝇ","Ꝉ":"ꝉ","Ꝋ":"ꝋ","Ꝍ":"ꝍ","Ꝏ":"ꝏ","Ꝑ":"ꝑ","Ꝓ":"ꝓ","Ꝕ":"ꝕ","Ꝗ":"ꝗ","Ꝙ":"ꝙ","Ꝛ":"ꝛ","Ꝝ":"ꝝ","Ꝟ":"ꝟ","Ꝡ":"ꝡ","Ꝣ":"ꝣ","Ꝥ":"ꝥ","Ꝧ":"ꝧ","Ꝩ":"ꝩ","Ꝫ":"ꝫ","Ꝭ":"ꝭ","Ꝯ":"ꝯ","Ꝺ":"ꝺ","Ꝼ":"ꝼ","Ᵹ":"ᵹ","Ꝿ":"ꝿ","Ꞁ":"ꞁ","Ꞃ":"ꞃ","Ꞅ":"ꞅ","Ꞇ":"ꞇ","Ꞌ":"ꞌ","Ɥ":"ɥ","Ꞑ":"ꞑ","Ꞓ":"ꞓ","Ꞗ":"ꞗ","Ꞙ":"ꞙ","Ꞛ":"ꞛ","Ꞝ":"ꞝ","Ꞟ":"ꞟ","Ꞡ":"ꞡ","Ꞣ":"ꞣ","Ꞥ":"ꞥ","Ꞧ":"ꞧ","Ꞩ":"ꞩ","Ɦ":"ɦ","Ɜ":"ɜ","Ɡ":"ɡ","Ɬ":"ɬ","Ɪ":"ɪ","Ʞ":"ʞ","Ʇ":"ʇ","Ʝ":"ʝ","Ꭓ":"ꭓ","Ꞵ":"ꞵ","Ꞷ":"ꞷ","Ꞹ":"ꞹ","Ꞻ":"ꞻ","Ꞽ":"ꞽ","Ꞿ":"ꞿ","Ꟁ":"ꟁ","Ꟃ":"ꟃ","Ꞔ":"ꞔ","Ʂ":"ʂ","Ᶎ":"ᶎ","Ꟈ":"ꟈ","Ꟊ":"ꟊ","Ꟑ":"ꟑ","Ꟗ":"ꟗ","Ꟙ":"ꟙ","Ꟶ":"ꟶ","ꭰ":"Ꭰ","ꭱ":"Ꭱ","ꭲ":"Ꭲ","ꭳ":"Ꭳ","ꭴ":"Ꭴ","ꭵ":"Ꭵ","ꭶ":"Ꭶ","ꭷ":"Ꭷ","ꭸ":"Ꭸ","ꭹ":"Ꭹ","ꭺ":"Ꭺ","ꭻ":"Ꭻ","ꭼ":"Ꭼ","ꭽ":"Ꭽ","ꭾ":"Ꭾ","ꭿ":"Ꭿ","ꮀ":"Ꮀ","ꮁ":"Ꮁ","ꮂ":"Ꮂ","ꮃ":"Ꮃ","ꮄ":"Ꮄ","ꮅ":"Ꮅ","ꮆ":"Ꮆ","ꮇ":"Ꮇ","ꮈ":"Ꮈ","ꮉ":"Ꮉ","ꮊ":"Ꮊ","ꮋ":"Ꮋ","ꮌ":"Ꮌ","ꮍ":"Ꮍ","ꮎ":"Ꮎ","ꮏ":"Ꮏ","ꮐ":"Ꮐ","ꮑ":"Ꮑ","ꮒ":"Ꮒ","ꮓ":"Ꮓ","ꮔ":"Ꮔ","ꮕ":"Ꮕ","ꮖ":"Ꮖ","ꮗ":"Ꮗ","ꮘ":"Ꮘ","ꮙ":"Ꮙ","ꮚ":"Ꮚ","ꮛ":"Ꮛ","ꮜ":"Ꮜ","ꮝ":"Ꮝ","ꮞ":"Ꮞ","ꮟ":"Ꮟ","ꮠ":"Ꮠ","ꮡ":"Ꮡ","ꮢ":"Ꮢ","ꮣ":"Ꮣ","ꮤ":"Ꮤ","ꮥ":"Ꮥ","ꮦ":"Ꮦ","ꮧ":"Ꮧ","ꮨ":"Ꮨ","ꮩ":"Ꮩ","ꮪ":"Ꮪ","ꮫ":"Ꮫ","ꮬ":"Ꮬ","ꮭ":"Ꮭ","ꮮ":"Ꮮ","ꮯ":"Ꮯ","ꮰ":"Ꮰ","ꮱ":"Ꮱ","ꮲ":"Ꮲ","ꮳ":"Ꮳ","ꮴ":"Ꮴ","ꮵ":"Ꮵ","ꮶ":"Ꮶ","ꮷ":"Ꮷ","ꮸ":"Ꮸ","ꮹ":"Ꮹ","ꮺ":"Ꮺ","ꮻ":"Ꮻ","ꮼ":"Ꮼ","ꮽ":"Ꮽ","ꮾ":"Ꮾ","ꮿ":"Ꮿ","ﬀ":"ff","ﬁ":"fi","ﬂ":"fl","ﬃ":"ffi","ﬄ":"ffl","ﬅ":"st","ﬆ":"st","ﬓ":"մն","ﬔ":"մե","ﬕ":"մի","ﬖ":"վն","ﬗ":"մխ","Ａ":"ａ","Ｂ":"ｂ","Ｃ":"ｃ","Ｄ":"ｄ","Ｅ":"ｅ","Ｆ":"ｆ","Ｇ":"ｇ","Ｈ":"ｈ","Ｉ":"ｉ","Ｊ":"ｊ","Ｋ":"ｋ","Ｌ":"ｌ","Ｍ":"ｍ","Ｎ":"ｎ","Ｏ":"ｏ","Ｐ":"ｐ","Ｑ":"ｑ","Ｒ":"ｒ","Ｓ":"ｓ","Ｔ":"ｔ","Ｕ":"ｕ","Ｖ":"ｖ","Ｗ":"ｗ","Ｘ":"ｘ","Ｙ":"ｙ","Ｚ":"ｚ","𐐀":"𐐨","𐐁":"𐐩","𐐂":"𐐪","𐐃":"𐐫","𐐄":"𐐬","𐐅":"𐐭","𐐆":"𐐮","𐐇":"𐐯","𐐈":"𐐰","𐐉":"𐐱","𐐊":"𐐲","𐐋":"𐐳","𐐌":"𐐴","𐐍":"𐐵","𐐎":"𐐶","𐐏":"𐐷","𐐐":"𐐸","𐐑":"𐐹","𐐒":"𐐺","𐐓":"𐐻","𐐔":"𐐼","𐐕":"𐐽","𐐖":"𐐾","𐐗":"𐐿","𐐘":"𐑀","𐐙":"𐑁","𐐚":"𐑂","𐐛":"𐑃","𐐜":"𐑄","𐐝":"𐑅","𐐞":"𐑆","𐐟":"𐑇","𐐠":"𐑈","𐐡":"𐑉","𐐢":"𐑊","𐐣":"𐑋","𐐤":"𐑌","𐐥":"𐑍","𐐦":"𐑎","𐐧":"𐑏","𐒰":"𐓘","𐒱":"𐓙","𐒲":"𐓚","𐒳":"𐓛","𐒴":"𐓜","𐒵":"𐓝","𐒶":"𐓞","𐒷":"𐓟","𐒸":"𐓠","𐒹":"𐓡","𐒺":"𐓢","𐒻":"𐓣","𐒼":"𐓤","𐒽":"𐓥","𐒾":"𐓦","𐒿":"𐓧","𐓀":"𐓨","𐓁":"𐓩","𐓂":"𐓪","𐓃":"𐓫","𐓄":"𐓬","𐓅":"𐓭","𐓆":"𐓮","𐓇":"𐓯","𐓈":"𐓰","𐓉":"𐓱","𐓊":"𐓲","𐓋":"𐓳","𐓌":"𐓴","𐓍":"𐓵","𐓎":"𐓶","𐓏":"𐓷","𐓐":"𐓸","𐓑":"𐓹","𐓒":"𐓺","𐓓":"𐓻","𐕰":"𐖗","𐕱":"𐖘","𐕲":"𐖙","𐕳":"𐖚","𐕴":"𐖛","𐕵":"𐖜","𐕶":"𐖝","𐕷":"𐖞","𐕸":"𐖟","𐕹":"𐖠","𐕺":"𐖡","𐕼":"𐖣","𐕽":"𐖤","𐕾":"𐖥","𐕿":"𐖦","𐖀":"𐖧","𐖁":"𐖨","𐖂":"𐖩","𐖃":"𐖪","𐖄":"𐖫","𐖅":"𐖬","𐖆":"𐖭","𐖇":"𐖮","𐖈":"𐖯","𐖉":"𐖰","𐖊":"𐖱","𐖌":"𐖳","𐖍":"𐖴","𐖎":"𐖵","𐖏":"𐖶","𐖐":"𐖷","𐖑":"𐖸","𐖒":"𐖹","𐖔":"𐖻","𐖕":"𐖼","𐲀":"𐳀","𐲁":"𐳁","𐲂":"𐳂","𐲃":"𐳃","𐲄":"𐳄","𐲅":"𐳅","𐲆":"𐳆","𐲇":"𐳇","𐲈":"𐳈","𐲉":"𐳉","𐲊":"𐳊","𐲋":"𐳋","𐲌":"𐳌","𐲍":"𐳍","𐲎":"𐳎","𐲏":"𐳏","𐲐":"𐳐","𐲑":"𐳑","𐲒":"𐳒","𐲓":"𐳓","𐲔":"𐳔","𐲕":"𐳕","𐲖":"𐳖","𐲗":"𐳗","𐲘":"𐳘","𐲙":"𐳙","𐲚":"𐳚","𐲛":"𐳛","𐲜":"𐳜","𐲝":"𐳝","𐲞":"𐳞","𐲟":"𐳟","𐲠":"𐳠","𐲡":"𐳡","𐲢":"𐳢","𐲣":"𐳣","𐲤":"𐳤","𐲥":"𐳥","𐲦":"𐳦","𐲧":"𐳧","𐲨":"𐳨","𐲩":"𐳩","𐲪":"𐳪","𐲫":"𐳫","𐲬":"𐳬","𐲭":"𐳭","𐲮":"𐳮","𐲯":"𐳯","𐲰":"𐳰","𐲱":"𐳱","𐲲":"𐳲","𑢠":"𑣀","𑢡":"𑣁","𑢢":"𑣂","𑢣":"𑣃","𑢤":"𑣄","𑢥":"𑣅","𑢦":"𑣆","𑢧":"𑣇","𑢨":"𑣈","𑢩":"𑣉","𑢪":"𑣊","𑢫":"𑣋","𑢬":"𑣌","𑢭":"𑣍","𑢮":"𑣎","𑢯":"𑣏","𑢰":"𑣐","𑢱":"𑣑","𑢲":"𑣒","𑢳":"𑣓","𑢴":"𑣔","𑢵":"𑣕","𑢶":"𑣖","𑢷":"𑣗","𑢸":"𑣘","𑢹":"𑣙","𑢺":"𑣚","𑢻":"𑣛","𑢼":"𑣜","𑢽":"𑣝","𑢾":"𑣞","𑢿":"𑣟","𖹀":"𖹠","𖹁":"𖹡","𖹂":"𖹢","𖹃":"𖹣","𖹄":"𖹤","𖹅":"𖹥","𖹆":"𖹦","𖹇":"𖹧","𖹈":"𖹨","𖹉":"𖹩","𖹊":"𖹪","𖹋":"𖹫","𖹌":"𖹬","𖹍":"𖹭","𖹎":"𖹮","𖹏":"𖹯","𖹐":"𖹰","𖹑":"𖹱","𖹒":"𖹲","𖹓":"𖹳","𖹔":"𖹴","𖹕":"𖹵","𖹖":"𖹶","𖹗":"𖹷","𖹘":"𖹸","𖹙":"𖹹","𖹚":"𖹺","𖹛":"𖹻","𖹜":"𖹼","𖹝":"𖹽","𖹞":"𖹾","𖹟":"𖹿","𞤀":"𞤢","𞤁":"𞤣","𞤂":"𞤤","𞤃":"𞤥","𞤄":"𞤦","𞤅":"𞤧","𞤆":"𞤨","𞤇":"𞤩","𞤈":"𞤪","𞤉":"𞤫","𞤊":"𞤬","𞤋":"𞤭","𞤌":"𞤮","𞤍":"𞤯","𞤎":"𞤰","𞤏":"𞤱","𞤐":"𞤲","𞤑":"𞤳","𞤒":"𞤴","𞤓":"𞤵","𞤔":"𞤶","𞤕":"𞤷","𞤖":"𞤸","𞤗":"𞤹","𞤘":"𞤺","𞤙":"𞤻","𞤚":"𞤼","𞤛":"𞤽","𞤜":"𞤾","𞤝":"𞤿","𞤞":"𞥀","𞤟":"𞥁","𞤠":"𞥂","𞤡":"𞥃"}'::jsonb)->>ch,ch),'' order by n),'')
 from regexp_split_to_table(p,'') with ordinality x(ch,n);
$function$;
revoke all on function public.v22_target_keyword_casefold(text) from public,anon,authenticated;
grant execute on function public.v22_target_keyword_casefold(text) to service_role;

create function public.validate_v22_target_keyword_settings(p jsonb) returns void
language plpgsql immutable set search_path=public as $function$
declare item jsonb;
begin
 if jsonb_typeof(p->'target_keywords') is distinct from 'array' or jsonb_array_length(p->'target_keywords') not between 3 and 5
  or jsonb_typeof(p->'keyword_scope') is distinct from 'object'
  or (p->'keyword_scope')-array['primary_service','target_market']<>'{}'::jsonb
  or length(btrim(coalesce(p#>>'{keyword_scope,primary_service}',''))) not between 1 and 200
  or jsonb_typeof(p#>'{keyword_scope,target_market}') is distinct from 'object'
  or length(coalesce(p#>>'{keyword_scope,target_market,display_name}',''))=0
  or coalesce(p#>>'{keyword_scope,target_market,country_code}','') !~ '^[A-Z]{2}$'
  or not(p ? 'keyword_confirmation')
 then raise exception 'PLANNING_SETTINGS_INVALID'; end if;
 for item in select value from jsonb_array_elements(p->'target_keywords') loop
  if jsonb_typeof(item) is distinct from 'object' or item-array['query','origin','suggestion_refs']<>'{}'::jsonb
   or not(item ?& array['query','origin','suggestion_refs']) or jsonb_typeof(item->'query') is distinct from 'string'
   or length(btrim(item->>'query')) not between 1 and 300 or item->>'query' is distinct from btrim(item->>'query')
   or item->>'query' ~ '[[:cntrl:]]' or coalesce(item->>'origin','') not in ('seo','system_accepted')
   or jsonb_typeof(item->'suggestion_refs') is distinct from 'array' or jsonb_array_length(item->'suggestion_refs')>10
   or exists(select 1 from jsonb_array_elements(item->'suggestion_refs') r where jsonb_typeof(r)<>'string' or length(r#>>'{}') not between 1 and 300)
  then raise exception 'PLANNING_SETTINGS_INVALID'; end if;
 end loop;
 if (select count(distinct public.v22_target_keyword_casefold(v->>'query')) from jsonb_array_elements(p->'target_keywords') v)<>jsonb_array_length(p->'target_keywords')
 then raise exception 'PLANNING_SETTINGS_INVALID'; end if;
end;
$function$;

-- Existing revision/CAS/idempotency/ownership checks remain the single save path.
do $migration$
declare definition text; previous text;
begin
 select pg_get_functiondef('public.save_v22_case_planning_settings(uuid,uuid,integer,jsonb)'::regprocedure) into strict definition;
 previous:=$old$  if p_expected_revision is null$old$;
 if position(previous in definition)=0 then raise exception 'P101_KEYWORD_SAVE_TARGET_MISSING'; end if;
 definition=replace(definition,previous,$new$  if p_settings->>'schema_version'='v22_planning_settings_v2' then
    perform public.validate_v22_target_keyword_settings(p_settings);
  end if;
  if p_expected_revision is null$new$);
 previous:=$old$p_settings-array['schema_version','priority','target_pages','execution_conditions']$old$;
 if position(previous in definition)=0 then raise exception 'P101_KEYWORD_SAVE_KEYS_TARGET_MISSING'; end if;
 definition=replace(definition,previous,$new$p_settings-(array['schema_version','priority','target_pages','execution_conditions']||case when p_settings->>'schema_version'='v22_planning_settings_v2' then array['target_keywords','keyword_scope','keyword_confirmation'] else array[]::text[] end)$new$);
 previous:=$old$p_settings->>'schema_version' is distinct from 'v22_planning_settings_v1'$old$;
 if position(previous in definition)=0 then raise exception 'P101_KEYWORD_SAVE_VERSION_TARGET_MISSING'; end if;
 definition=replace(definition,previous,$new$coalesce(p_settings->>'schema_version','') not in ('v22_planning_settings_v1','v22_planning_settings_v2')$new$);
 previous:=$old$saved.settings=p_settings$old$;
 if position(previous in definition)=0 then raise exception 'P101_KEYWORD_SAVE_IDEMPOTENCY_TARGET_MISSING'; end if;
 definition=replace(definition,previous,$new$(case when p_settings->>'schema_version'='v22_planning_settings_v2' then saved.settings-'keyword_confirmation'=p_settings-'keyword_confirmation' else saved.settings=p_settings end)$new$);
 previous:=$old$  insert into public.case_planning_settings$old$;
 if position(previous in definition)=0 then raise exception 'P101_KEYWORD_SAVE_INSERT_TARGET_MISSING'; end if;
 definition=replace(definition,previous,$new$  if p_settings->>'schema_version'='v22_planning_settings_v2' then
    p_settings=jsonb_set(p_settings,'{keyword_confirmation}',case when saved.settings->>'schema_version'='v22_planning_settings_v2'
      and saved.settings->'target_keywords'=p_settings->'target_keywords' and saved.settings->'keyword_scope'=p_settings->'keyword_scope'
      then saved.settings->'keyword_confirmation' else jsonb_build_object('confirmed_by',p_user_id,'confirmed_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) end);
  end if;
  insert into public.case_planning_settings$new$);
 execute definition;
end;
$migration$;

create table public.prospect_target_keyword_bindings (
 discovery_job_id uuid primary key references public.prospect_discovery_tasks(discovery_job_id),
 workflow_id uuid not null references public.workflow_charges(id),
 user_id uuid not null references public.users(id),case_id uuid not null references public.client_cases(id),
 planning_revision integer not null, binding jsonb not null, keyword_scope jsonb not null,
 foreign key(case_id,planning_revision) references public.case_planning_settings(case_id,revision),
 created_at timestamptz not null default now()
);
alter table public.prospect_target_keyword_bindings enable row level security;
revoke all on public.prospect_target_keyword_bindings from public,anon,authenticated,service_role;
grant select on public.prospect_target_keyword_bindings to service_role;
create trigger immutable_target_keyword_binding before update or delete on public.prospect_target_keyword_bindings
 for each row execute function public.reject_v22_capability_mutation();

create function public.start_v22_prospect_discovery_with_keywords(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
 p_discovery_job_id uuid,p_workflow_idempotency_key text,p_task_idempotency_key text,p_planning_revision integer,
 p_queries_canonical text,p_keyword_scope jsonb)
returns table(workflow_id uuid,discovery_job_id uuid,charge_state text,created boolean,idempotent boolean,credit_balance integer)
language plpgsql security definer set search_path=public as $function$
declare saved jsonb; queries jsonb; pinned public.prospect_target_keyword_bindings; new_binding jsonb;
begin
 perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
 if not found then raise exception 'PLANNING_CASE_NOT_FOUND'; end if;
 if p_queries_canonical is null or octet_length(p_queries_canonical)>15000 or p_planning_revision is null or p_planning_revision<1
 then raise exception 'TARGET_KEYWORDS_REQUIRED'; end if;
 queries=p_queries_canonical::jsonb;
 new_binding=jsonb_build_object('schema_version','v22_target_keyword_binding_v1','queries',queries,
  'queries_digest','sha256:'||encode(sha256(convert_to(p_queries_canonical,'UTF8')),'hex'),'planning_revision',p_planning_revision);
 select * into pinned from public.prospect_target_keyword_bindings b where b.discovery_job_id=p_discovery_job_id;
 if pinned.discovery_job_id is not null then
  if pinned.user_id<>p_user_id or pinned.case_id<>p_case_id or pinned.workflow_id<>p_workflow_id
   or pinned.binding<>new_binding or pinned.keyword_scope<>p_keyword_scope then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
 else
  if exists(select 1 from public.prospect_discovery_tasks t where t.discovery_job_id=p_discovery_job_id)
   then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
  saved=public.get_v22_case_planning_settings(p_user_id,p_case_id);
  if (saved->>'revision')::integer<>p_planning_revision then raise exception 'PLANNING_SETTINGS_CONFLICT' using errcode='40001'; end if;
  if saved#>>'{settings,schema_version}' is distinct from 'v22_planning_settings_v2'
   or jsonb_typeof(saved#>'{settings,keyword_confirmation}') is distinct from 'object'
   or (select jsonb_agg(k->'query' order by n) from jsonb_array_elements(saved#>'{settings,target_keywords}') with ordinality x(k,n)) is distinct from queries
   or saved#>'{settings,keyword_scope}' is distinct from p_keyword_scope then raise exception 'TARGET_KEYWORDS_REQUIRED'; end if;
 end if;
 return query select * from public.start_v22_prospect_discovery(p_user_id,p_case_id,p_workflow_id,p_discovery_job_id,p_workflow_idempotency_key,p_task_idempotency_key);
 if pinned.discovery_job_id is null then
  insert into public.prospect_target_keyword_bindings(discovery_job_id,workflow_id,user_id,case_id,planning_revision,binding,keyword_scope)
   values(p_discovery_job_id,p_workflow_id,p_user_id,p_case_id,p_planning_revision,new_binding,p_keyword_scope);
 end if;
end;
$function$;

create function public.assert_v22_discovery_target_keywords(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,p_discovery_id uuid,p_body jsonb)
returns void language plpgsql stable security definer set search_path=public as $function$
declare pinned public.prospect_target_keyword_bindings; settings jsonb;
begin
 select * into pinned from public.prospect_target_keyword_bindings where discovery_job_id=p_discovery_id;
 if pinned.discovery_job_id is null then
  if p_body ? 'target_keywords' then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
  return;
 end if;
 if pinned.user_id<>p_user_id or pinned.case_id<>p_case_id or pinned.workflow_id<>p_workflow_id
  or p_body->'target_keywords' is distinct from pinned.binding
  or p_body#>'{analyze_request,queries}' is distinct from pinned.binding->'queries'
  or jsonb_build_object('primary_service',p_body#>'{analyze_request,primary_service}','target_market',p_body#>'{analyze_request,target_market}') is distinct from pinned.keyword_scope
 then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
 -- Later optional planning revisions are allowed only when this exact word list/scope remains.
 settings=public.get_v22_case_planning_settings(p_user_id,p_case_id)->'settings';
 if settings->>'schema_version' is distinct from 'v22_planning_settings_v2' or (select jsonb_agg(k->'query' order by n) from jsonb_array_elements(settings->'target_keywords') with ordinality x(k,n)) is distinct from pinned.binding->'queries'
  or settings->'keyword_scope' is distinct from pinned.keyword_scope then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
end;
$function$;

-- Validate before enrollment/collection. Replays still recover the already enrolled immutable envelope.
do $migration$
declare definition text; previous text;
begin
 select pg_get_functiondef('public.begin_v22_acquisition_preparation(uuid,uuid,uuid,text,uuid,text)'::regprocedure) into strict definition;
 previous:=$old$body->>'schema_version' is distinct from 'v22_analysis_request_envelope_v1'$old$;
 if position(previous in definition)=0 then raise exception 'P101_KEYWORD_ENVELOPE_VERSION_TARGET_MISSING'; end if;
 definition=replace(definition,previous,$new$coalesce(body->>'schema_version','') not in ('v22_analysis_request_envelope_v1','v22_analysis_request_envelope_v2')
    or (body->>'schema_version'='v22_analysis_request_envelope_v2') is distinct from (body ? 'target_keywords')$new$);
 previous:=$old$body-array['schema_version','analyze_request','competitor_discovery']$old$;
 if position(previous in definition)=0 then raise exception 'P101_KEYWORD_ENVELOPE_KEYS_TARGET_MISSING'; end if;
 definition=replace(definition,previous,$new$body-(array['schema_version','analyze_request','competitor_discovery']||case when body->>'schema_version'='v22_analysis_request_envelope_v2' then array['target_keywords'] else array[]::text[] end)$new$);
 previous:=$old$  checksum='sha256:'$old$;
 if position(previous in definition)=0 then raise exception 'P101_KEYWORD_ENVELOPE_BINDING_TARGET_MISSING'; end if;
 definition=replace(definition,previous,$new$  if body->>'schema_version'='v22_analysis_request_envelope_v2' then
    select * into charge from public.workflow_charges where analysis_job_id=p_job_id and user_id=p_user_id and case_id=p_case_id and workflow_kind='prospect';
    if charge.id is null then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
    perform public.assert_v22_discovery_target_keywords(p_user_id,p_case_id,charge.id,(body#>>'{competitor_discovery,discovery_id}')::uuid,body);
  end if;
  checksum='sha256:'$new$);
 execute definition;
 select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='prepare_v22_capability_analysis_input_core';
 previous:=$old$  if p_manifest->>'schema_version'='v22_analysis_input_v4' and$old$;
 if position(previous in definition)=0 then raise exception 'P101_KEYWORD_GENERATION_TARGET_MISSING'; end if;
 definition=replace(definition,previous,$new$  if p_manifest->>'schema_version'='v22_analysis_input_v4' and exists(
    select 1 from public.capability_acquisition_preparations p where p.job_id=(p_manifest->>'job_id')::uuid and p.request ? 'target_keywords'
      and p.request#>'{target_keywords,queries}' is distinct from p_manifest->'keyword_queries') then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
  if p_manifest->>'schema_version'='v22_analysis_input_v4' and$new$);
 execute definition;
 select pg_get_functiondef('public.start_v22_acquisition_intake(uuid,uuid,uuid,uuid,text,uuid,text,uuid)'::regprocedure) into strict definition;
 previous:=$old$  select coalesce(max(revision),0) into current_revision$old$;
 if position(previous in definition)=0 then raise exception 'P101_KEYWORD_INTAKE_TARGET_MISSING'; end if;
 definition=replace(definition,previous,$new$  perform public.assert_v22_discovery_target_keywords(p_user_id,p_case_id,p_workflow_id,p_discovery_id,body);
  select coalesce(max(revision),0) into current_revision$new$);
 execute definition;
end;
$migration$;

revoke all on function public.validate_v22_target_keyword_settings(jsonb) from public,anon,authenticated;
revoke all on function public.start_v22_prospect_discovery_with_keywords(uuid,uuid,uuid,uuid,text,text,integer,text,jsonb) from public,anon,authenticated;
revoke all on function public.assert_v22_discovery_target_keywords(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.validate_v22_target_keyword_settings(jsonb) to service_role;
grant execute on function public.start_v22_prospect_discovery_with_keywords(uuid,uuid,uuid,uuid,text,text,integer,text,jsonb) to service_role;
grant execute on function public.assert_v22_discovery_target_keywords(uuid,uuid,uuid,uuid,jsonb) to service_role;
commit;
