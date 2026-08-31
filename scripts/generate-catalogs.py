#!/usr/bin/env python3
"""Regenerate the YearAfter name and location catalogs.

Kept out of the repo deliberately: the JSON is the artifact and is hand-editable.
This exists so the initial bulk stays internally consistent (every culture the
same depth, every city a real mix) rather than drifting as it was typed.
"""
import json, pathlib

S = str.split  # whitespace split

# ---------------------------------------------------------------- cultures ---
# 12 naming traditions. 30 male / 30 female / 34 surnames each.
CULTURES = {
"us-en": ("United States (English)",
 S("""James Michael Robert David Daniel Marcus Elliot Owen Silas Andre Felix Wesley Jordan Tyler
      Brandon Nathan Caleb Ethan Logan Mason Hunter Grant Miles Desmond Trevor Colton Preston
      Garrett Dominic Xavier"""),
 S("""Mary Jennifer Alma June Nadia Wren Cleo Harper Sloane Delia Ruth Naomi Ashley Brittany Megan
      Kayla Sierra Autumn Willow Piper Quinn Reagan Everly Tessa Blair Juniper Sage Nova Elise
      Marlowe"""),
 S("""Vaughn Bellamy Doyle Whitaker Sutton Hollis Marsh Delaney Crane Pierce Ashford Kinney Rowe
      Sinclair Holloway Whitfield Barlow Prescott Langford Hendricks Caldwell Fitzgerald Alderman
      Thatcher Winslow Redmond Stapleton Brockman Farrow Vance Yeager Kilgore Ransom Ellsworth""")),

"gb-en": ("United Kingdom (English)",
 S("""Oliver Harry Archie Callum Rory Nigel Alistair Gareth Dermot Fraser Rupert Neil Finlay Angus
      Tobias Barnaby Crispin Duncan Ewan Hamish Jasper Lachlan Malcolm Nevil Percival Quentin
      Reginald Seamus Tarquin Wilfred"""),
 S("""Amelia Freya Nia Imogen Fiona Bronwen Sian Clodagh Petra Maeve Rhian Verity Beatrix Cerys
      Dilys Eilidh Ffion Gwyneth Isla Lorna Morag Niamh Orla Poppy Rosalind Saoirse Tamsin Una
      Winifred Zara"""),
 S("""Ashcombe Pennington Fairweather Kirkby Larkin Blackwood Mallory Wrenfield Cavendish Hargrave
      Ellery Tenby Standish Thistlewood Abernathy Braithwaite Carmichael Dunmore Fitzwilliam
      Gallagher Huxley Inglethorpe Kensington Lymington Mountjoy Norwood Ottershaw Pemberton
      Quillon Ravenscroft Sedgwick Trelawney Underhill Wycliffe""")),

"mx-es": ("Mexico (Spanish)",
 S("""Mateo Santiago Diego Emiliano Rodrigo Alonso Ignacio Rafael Joaquín Tomás Salvador Nicolás
      Alejandro Sebastián Leonardo Gabriel Andrés Fernando Ricardo Eduardo Javier Arturo Ramón
      Óscar Guillermo Héctor Enrique Rubén Cristóbal Aurelio"""),
 S("""Sofía Valentina Regina Ximena Lucía Renata Itzel Guadalupe Marisol Camila Paloma Esperanza
      Isabela Fernanda Mariana Daniela Alejandra Adriana Gabriela Carmen Rocío Beatriz Dolores
      Leticia Consuelo Araceli Yolanda Verónica Silvia Rosario"""),
 S("""Reyes Ferrer Delgado Salazar Ibarra Quintero Mendoza Escamilla Villalobos Bustamante Carrasco
      Ontiveros Zúñiga Padilla Cervantes Montalvo Guerrero Arellano Pacheco Villarreal Solís Barrera
      Cárdenas Fuentes Galindo Herrera Jiménez Lozano Márquez Nájera Orozco Peralta Rivas
      Sandoval""")),

"br-pt": ("Brazil (Portuguese)",
 S("""Miguel Arthur Davi Bernardo Thiago Caio Vinícius Murilo Otávio Leandro Emerson Everton Gustavo
      Felipe Bruno Diogo Matheus Lucas Pedro Henrique Ígor Alisson Danilo Fábio Márcio Nélson Válter
      Wallace Cauã Ronaldo"""),
 S("""Alice Helena Manuela Beatriz Larissa Juliana Bruna Carolina Vitória Tainá Rafaela Solange
      Fernanda Patrícia Luana Gabriela Amanda Camila Débora Elaine Flávia Ivone Jaqueline Kelly
      Lorena Márcia Nubia Priscila Rosângela Simone"""),
 S("""Oliveira Almeida Ribeiro Carvalho Barbosa Nogueira Teixeira Macedo Bittencourt Rocha Andrade
      Queiroz Fontoura Marinho Azevedo Bezerra Cavalcanti Dantas Esteves Fagundes Guimarães Lacerda
      Monteiro Novaes Pontes Rezende Sampaio Tavares Vasconcelos Xavier Werneck Alvarenga Brandão
      Couto""")),

"jp": ("Japan",
 S("""Haruto Sota Ren Yuto Kaito Riku Takumi Hiroshi Daichi Shun Naoki Kenji Souta Yuma Itsuki Asahi
      Minato Haruki Yamato Kouki Tsubasa Rihito Satoru Nobuo Katsumi Tetsuya Masaru Isamu Jiro
      Tadashi"""),
 S("""Yui Aoi Rin Hina Sakura Mei Nanami Akari Emi Chiyo Mizuki Haruka Yuna Ichika Tsumugi Kokoro
      Sana Miyu Kaede Honoka Ayaka Nozomi Shiori Kanon Wakana Fumiko Setsuko Yoshiko Tomoe Kiyomi"""),
 S("""Nakamura Takahashi Fujimori Kirishima Ozaki Watanabe Hayashi Sugimoto Morikawa Tachibana
      Yamashiro Kuroda Ishizuka Minamoto Aoyama Shimizu Nishida Okamoto Kobayashi Matsuda Inoue
      Sakamoto Hirano Kawaguchi Tanabe Ueda Ogawa Fukuda Miyazaki Noguchi Hasegawa Terada Yoshimura
      Kondo""")),

"ng": ("Nigeria",
 S("""Chidi Emeka Tunde Femi Kelechi Obinna Segun Ikenna Adewale Chinedu Bayo Uche Chukwuemeka
      Olamide Ayodele Ifeanyi Babatunde Nnamdi Oluwaseun Chibuzo Kayode Ekene Damilare Onyeka
      Abiodun Chigozie Temidayo Nonso Gbenga Somto"""),
 S("""Amara Ngozi Folake Chiamaka Adaeze Yewande Ifeoma Temitope Zainab Nneka Bisi Chinyere Adanna
      Oluchi Funmilayo Chidinma Abisola Uchenna Simisola Nkechi Titilayo Ebele Morenike Chinelo
      Damilola Obiageli Kemi Ifunanya Bolanle Ozioma"""),
 S("""Okafor Adeyemi Balogun Nwosu Okonkwo Adebayo Eze Obasi Ogunleye Chukwu Afolabi Nwachukwu
      Olawale Ibekwe Adekunle Nwankwo Oyelaran Ezeugo Babangida Onwuka Adesanya Iheanacho Okoro
      Bamidele Uzochukwu Ogundipe Chiweshe Nwaneri Abiola Oduya Emenike Falana Ojukwu Anyanwu""")),

"de": ("Germany",
 S("""Lukas Jonas Maximilian Tobias Matthias Sebastian Florian Andreas Niklas Kilian Rainer Bastian
      Leon Julian Philipp Moritz Fabian Simon Benedikt Konrad Dietrich Gerhard Helmut Joachim Klaus
      Manfred Norbert Ottmar Reinhold Volker"""),
 S("""Hannah Lena Greta Annika Franziska Ingrid Johanna Katharina Marlene Heike Sabine Elke Mia Emilia
      Leonie Charlotte Amelie Frieda Helga Gisela Roswitha Ulrike Brigitte Cornelia Dagmar Petra
      Sieglinde Waltraud Anneliese Christiane"""),
 S("""Brandt Vogel Keller Hartmann Schreiber Baumgartner Weiss Kirchner Reinhardt Steinbach Lehmann
      Dorn Frankl Achterberg Zimmermann Wolfram Bergmann Hoffmann Krause Neumann Richter Schuster
      Thalberg Ullmann Vollmer Weickert Ziegler Eckhardt Freitag Grunwald Holzmann Jansen Köhler
      Lindner""")),

"in": ("India",
 S("""Aarav Vihaan Arjun Rohan Aditya Karthik Rajesh Vikram Sanjay Nikhil Pranav Ishaan Devendra
      Harish Manish Naveen Prakash Ramesh Suresh Tarun Uday Varun Yash Abhishek Deepak Gaurav
      Jitendra Mohit Rakesh Siddharth"""),
 S("""Ananya Diya Aditi Kavya Meera Priya Riya Sanjana Shreya Tanvi Aishwarya Bhavna Chitra Deepika
      Gauri Indira Jyoti Kamala Lakshmi Madhuri Nisha Pooja Radhika Sunita Trisha Usha Vandana
      Yamini Anjali Rekha"""),
 S("""Sharma Patel Reddy Iyer Nair Chatterjee Banerjee Mehta Kapoor Malhotra Deshpande Joshi Rao
      Menon Pillai Bhattacharya Chauhan Dhawan Gupta Hegde Kulkarni Lal Mukherjee Naidu Oberoi
      Prasad Rajan Sengupta Trivedi Varma Agarwal Bose Ghosh Sundaram""")),

"cn": ("China",
 S("""Wei Hao Jun Lei Ming Yang Chen Feng Bo Kai Peng Tao Xiang Yong Zhen Cheng Dong Gang Hui Jian
      Liang Ning Qiang Rui Sheng Tian Wen Xin Yun Zhi"""),
 S("""Xiu Ying Lan Mei Fang Juan Yan Hong Ling Ping Qing Rong Shan Ting Wan Xia Yu Zhen Jing Li Min
      Na Shu Xue Zhu Hua Lian Cui Jie Yue"""),
 S("""Wang Li Zhang Liu Chen Yang Huang Zhao Wu Zhou Xu Sun Ma Zhu Hu Guo He Gao Lin Luo Zheng Liang
      Xie Song Tang Han Feng Deng Cao Peng Zeng Xiao Tian Dong""")),

"kr": ("South Korea",
 S("""Minjun Seojun Doyun Jiho Hajun Junseo Junwoo Yejun Siwoo Jiwon Hyunwoo Sungmin Jaehyun Taeyang
      Donghyun Youngho Kyungsoo Sangwoo Chulsoo Jinwoo Byungho Daehan Eunwoo Gunwoo Hoseok Ilseong
      Jungkook Kihoon Minseok Namjoon"""),
 S("""Seoyeon Seoah Jiwoo Haeun Jia Hayoon Yuna Sua Chaewon Eunseo Jimin Soyeon Hyejin Minji Yerin
      Dahyun Sunhwa Bora Jinah Kyungmi Nayeon Ohyun Sujin Taeyeon Wonyoung Yoojin Areum Boram
      Chorong Dasom"""),
 S("""Kim Lee Park Choi Jung Kang Cho Yoon Jang Lim Han Oh Seo Shin Kwon Hwang Ahn Song Ryu Hong Jeon
      Ko Moon Son Baek Heo Yoo Nam Noh Ha Kwak Sung Cha Joo""")),

"fr": ("France",
 S("""Gabriel Raphaël Louis Jules Adam Maël Hugo Arthur Nathan Théo Antoine Baptiste Clément Damien
      Étienne Fabrice Guillaume Henri Julien Laurent Mathieu Nicolas Olivier Pascal Quentin Rémy
      Sylvain Thierry Vincent Yannick"""),
 S("""Emma Jade Louise Alice Chloé Léa Manon Camille Sarah Inès Amélie Brigitte Céline Delphine
      Élodie Florence Geneviève Hélène Isabelle Josephine Katia Laurence Mathilde Nathalie Océane
      Pauline Solène Thérèse Valérie Yvette"""),
 S("""Moreau Lefèvre Girard Bonnet Dupont Lambert Fontaine Rousseau Vidal Caron Marchand Perrin Blanc
      Chevalier Dumas Faure Garnier Henriot Jourdain Lacroix Mercier Noël Olivier Poirier Renard
      Sauvage Thibault Vasseur Aubert Beaumont Courtois Delacroix Ferrand Guyot""")),

"it": ("Italy",
 S("""Leonardo Francesco Alessandro Lorenzo Matteo Andrea Gabriele Riccardo Tommaso Edoardo Giuseppe
      Antonio Marco Stefano Paolo Roberto Salvatore Vincenzo Domenico Emanuele Fabio Gianluca Luca
      Massimo Nicola Pietro Sergio Umberto Valerio Dario"""),
 S("""Sofia Giulia Aurora Alice Ginevra Emma Beatrice Vittoria Chiara Francesca Alessandra Barbara
      Carlotta Daniela Elena Federica Gaia Ilaria Lucia Martina Nicoletta Ornella Paola Rosalia
      Serena Tiziana Valentina Bianca Cristina Marcella"""),
 S("""Rossi Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De_Luca
      Mancini Costa Giordano Rizzo Lombardi Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara
      Galli Martini Leone Longo Gentile Martinelli Vitale Lombardo Serra""")),
}

# ---------------------------------------------------------------- cities -----
# (id, city, regionCode, region, countryCode, country, weight, mix)
# Every city carries a MIX. Major cities everywhere have diaspora; a single-culture
# city is a simplification we do not need.
def mix(*pairs):
    return [{"culture": c, "weight": w} for c, w in pairs]

US_GENERAL   = ("us-en", 70), ("mx-es", 12), ("ng", 8), ("de", 4), ("in", 3), ("cn", 3)
US_SOUTHWEST = ("us-en", 55), ("mx-es", 30), ("ng", 5), ("in", 4), ("cn", 4), ("kr", 2)
US_SOUTHEAST = ("us-en", 56), ("ng", 24), ("mx-es", 12), ("in", 4), ("cn", 4)
US_PACIFIC   = ("us-en", 54), ("cn", 12), ("mx-es", 12), ("kr", 8), ("jp", 6), ("in", 8)
US_NORTHEAST = ("us-en", 62), ("it", 10), ("ng", 10), ("mx-es", 6), ("in", 6), ("cn", 6)

CITIES = [
 # --- United States -------------------------------------------------------
 ("us-ny-nyc","New York City","NY","New York","US","United States",90, mix(("us-en",50),("mx-es",12),("ng",9),("cn",9),("it",8),("in",7),("br-pt",5))),
 ("us-ca-los-angeles","Los Angeles","CA","California","US","United States",72, mix(*US_SOUTHWEST)),
 ("us-il-chicago","Chicago","IL","Illinois","US","United States",46, mix(("us-en",58),("mx-es",20),("ng",12),("in",5),("cn",5))),
 ("us-tx-houston","Houston","TX","Texas","US","United States",44, mix(*US_SOUTHWEST)),
 ("us-az-phoenix","Phoenix","AZ","Arizona","US","United States",34, mix(*US_SOUTHWEST)),
 ("us-pa-philadelphia","Philadelphia","PA","Pennsylvania","US","United States",32, mix(*US_NORTHEAST)),
 ("us-tx-san-antonio","San Antonio","TX","Texas","US","United States",30, mix(("us-en",48),("mx-es",42),("ng",4),("in",3),("cn",3))),
 ("us-ca-san-diego","San Diego","CA","California","US","United States",28, mix(*US_SOUTHWEST)),
 ("us-tx-dallas","Dallas","TX","Texas","US","United States",30, mix(*US_SOUTHWEST)),
 ("us-ca-san-jose","San Jose","CA","California","US","United States",24, mix(("us-en",40),("in",20),("cn",14),("mx-es",14),("kr",6),("jp",6))),
 ("us-tx-austin","Austin","TX","Texas","US","United States",24, mix(*US_SOUTHWEST)),
 ("us-fl-jacksonville","Jacksonville","FL","Florida","US","United States",22, mix(*US_SOUTHEAST)),
 ("us-oh-columbus","Columbus","OH","Ohio","US","United States",22, mix(*US_GENERAL)),
 ("us-nc-charlotte","Charlotte","NC","North Carolina","US","United States",22, mix(*US_SOUTHEAST)),
 ("us-in-indianapolis","Indianapolis","IN","Indiana","US","United States",20, mix(*US_GENERAL)),
 ("us-ca-san-francisco","San Francisco","CA","California","US","United States",24, mix(*US_PACIFIC)),
 ("us-wa-seattle","Seattle","WA","Washington","US","United States",26, mix(*US_PACIFIC)),
 ("us-co-denver","Denver","CO","Colorado","US","United States",24, mix(("us-en",66),("mx-es",22),("ng",4),("in",4),("cn",4))),
 ("us-dc-washington","Washington","DC","District of Columbia","US","United States",24, mix(("us-en",50),("ng",26),("mx-es",8),("in",6),("cn",5),("kr",5))),
 ("us-ma-boston","Boston","MA","Massachusetts","US","United States",26, mix(("us-en",58),("it",12),("br-pt",10),("ng",8),("cn",6),("in",6))),
 ("us-tn-nashville","Nashville","TN","Tennessee","US","United States",20, mix(*US_SOUTHEAST)),
 ("us-mi-detroit","Detroit","MI","Michigan","US","United States",22, mix(("us-en",56),("ng",26),("mx-es",8),("in",5),("cn",5))),
 ("us-or-portland","Portland","OR","Oregon","US","United States",20, mix(*US_PACIFIC)),
 ("us-nv-las-vegas","Las Vegas","NV","Nevada","US","United States",22, mix(*US_SOUTHWEST)),
 ("us-tn-memphis","Memphis","TN","Tennessee","US","United States",18, mix(*US_SOUTHEAST)),
 ("us-ky-louisville","Louisville","KY","Kentucky","US","United States",16, mix(*US_SOUTHEAST)),
 ("us-md-baltimore","Baltimore","MD","Maryland","US","United States",20, mix(("us-en",52),("ng",30),("mx-es",8),("in",5),("cn",5))),
 ("us-wi-milwaukee","Milwaukee","WI","Wisconsin","US","United States",16, mix(("us-en",58),("ng",20),("mx-es",12),("de",6),("in",4))),
 ("us-nm-albuquerque","Albuquerque","NM","New Mexico","US","United States",14, mix(("us-en",48),("mx-es",42),("ng",4),("in",3),("cn",3))),
 ("us-az-tucson","Tucson","AZ","Arizona","US","United States",14, mix(*US_SOUTHWEST)),
 ("us-ca-sacramento","Sacramento","CA","California","US","United States",18, mix(*US_PACIFIC)),
 ("us-mo-kansas-city","Kansas City","MO","Missouri","US","United States",16, mix(*US_GENERAL)),
 ("us-ga-atlanta","Atlanta","GA","Georgia","US","United States",26, mix(*US_SOUTHEAST)),
 ("us-fl-miami","Miami","FL","Florida","US","United States",26, mix(("us-en",36),("mx-es",36),("br-pt",12),("ng",8),("it",4),("in",4))),
 ("us-ca-riverside","Riverside","CA","California","US","United States",14, mix(*US_SOUTHWEST)),
 ("us-la-new-orleans","New Orleans","LA","Louisiana","US","United States",14, mix(("us-en",50),("ng",30),("fr",8),("mx-es",8),("in",4))),
 ("us-oh-cleveland","Cleveland","OH","Ohio","US","United States",14, mix(*US_GENERAL)),
 ("us-mn-minneapolis","Minneapolis","MN","Minnesota","US","United States",18, mix(("us-en",64),("ng",18),("mx-es",8),("de",5),("in",5))),
 ("us-pa-pittsburgh","Pittsburgh","PA","Pennsylvania","US","United States",14, mix(*US_NORTHEAST)),
 ("us-ut-salt-lake-city","Salt Lake City","UT","Utah","US","United States",12, mix(("us-en",70),("mx-es",18),("br-pt",4),("ng",4),("in",4))),

 # --- United Kingdom ------------------------------------------------------
 ("gb-eng-london","London","ENG","England","GB","United Kingdom",60, mix(("gb-en",52),("in",14),("ng",14),("fr",6),("it",6),("br-pt",4),("cn",4))),
 ("gb-eng-manchester","Manchester","ENG","England","GB","United Kingdom",22, mix(("gb-en",66),("in",12),("ng",12),("it",5),("cn",5))),
 ("gb-eng-birmingham","Birmingham","ENG","England","GB","United Kingdom",22, mix(("gb-en",58),("in",22),("ng",12),("it",4),("cn",4))),
 ("gb-sct-glasgow","Glasgow","SCT","Scotland","GB","United Kingdom",15, mix(("gb-en",80),("in",8),("ng",6),("it",6))),
 ("gb-sct-edinburgh","Edinburgh","SCT","Scotland","GB","United Kingdom",14, mix(("gb-en",80),("in",7),("ng",5),("fr",4),("it",4))),

 # --- Mexico --------------------------------------------------------------
 ("mx-cmx-mexico-city","Mexico City","CMX","Ciudad de México","MX","Mexico",55, mix(("mx-es",88),("us-en",5),("cn",3),("it",2),("fr",2))),
 ("mx-jal-guadalajara","Guadalajara","JAL","Jalisco","MX","Mexico",24, mix(("mx-es",92),("us-en",4),("cn",2),("it",2))),
 ("mx-nle-monterrey","Monterrey","NLE","Nuevo León","MX","Mexico",24, mix(("mx-es",90),("us-en",6),("cn",2),("it",2))),
 ("mx-pue-puebla","Puebla","PUE","Puebla","MX","Mexico",16, mix(("mx-es",94),("us-en",3),("it",3))),
 ("mx-bcn-tijuana","Tijuana","BCN","Baja California","MX","Mexico",16, mix(("mx-es",84),("us-en",10),("cn",3),("kr",3))),

 # --- Brazil --------------------------------------------------------------
 ("br-sp-sao-paulo","São Paulo","SP","São Paulo","BR","Brazil",48, mix(("br-pt",78),("it",8),("jp",6),("de",3),("mx-es",3),("ng",2))),
 ("br-rj-rio-de-janeiro","Rio de Janeiro","RJ","Rio de Janeiro","BR","Brazil",28, mix(("br-pt",84),("it",6),("ng",4),("mx-es",3),("de",3))),
 ("br-df-brasilia","Brasília","DF","Distrito Federal","BR","Brazil",18, mix(("br-pt",90),("it",4),("ng",3),("mx-es",3))),
 ("br-ba-salvador","Salvador","BA","Bahia","BR","Brazil",18, mix(("br-pt",84),("ng",10),("it",3),("mx-es",3))),
 ("br-mg-belo-horizonte","Belo Horizonte","MG","Minas Gerais","BR","Brazil",16, mix(("br-pt",88),("it",6),("ng",3),("de",3))),

 # --- Japan ---------------------------------------------------------------
 ("jp-13-tokyo","Tokyo","13","Tokyo","JP","Japan",55, mix(("jp",86),("kr",6),("cn",5),("us-en",3))),
 ("jp-27-osaka","Osaka","27","Osaka","JP","Japan",26, mix(("jp",86),("kr",7),("cn",5),("br-pt",2))),
 ("jp-14-yokohama","Yokohama","14","Kanagawa","JP","Japan",20, mix(("jp",88),("cn",5),("kr",4),("us-en",3))),
 ("jp-23-nagoya","Nagoya","23","Aichi","JP","Japan",18, mix(("jp",88),("br-pt",5),("cn",4),("kr",3))),
 ("jp-01-sapporo","Sapporo","01","Hokkaido","JP","Japan",14, mix(("jp",92),("kr",4),("cn",4))),

 # --- Nigeria -------------------------------------------------------------
 ("ng-la-lagos","Lagos","LA","Lagos","NG","Nigeria",52, mix(("ng",92),("gb-en",4),("cn",2),("in",2))),
 ("ng-fc-abuja","Abuja","FC","Federal Capital Territory","NG","Nigeria",20, mix(("ng",92),("gb-en",4),("cn",2),("in",2))),
 ("ng-kn-kano","Kano","KN","Kano","NG","Nigeria",18, mix(("ng",96),("gb-en",2),("in",2))),
 ("ng-oy-ibadan","Ibadan","OY","Oyo","NG","Nigeria",16, mix(("ng",95),("gb-en",3),("in",2))),

 # --- Germany -------------------------------------------------------------
 ("de-be-berlin","Berlin","BE","Berlin","DE","Germany",32, mix(("de",76),("fr",6),("it",6),("ng",5),("in",4),("cn",3))),
 ("de-by-munich","Munich","BY","Bavaria","DE","Germany",20, mix(("de",82),("it",8),("fr",4),("in",3),("cn",3))),
 ("de-hh-hamburg","Hamburg","HH","Hamburg","DE","Germany",18, mix(("de",82),("it",6),("br-pt",4),("ng",4),("cn",4))),
 ("de-nw-cologne","Cologne","NW","North Rhine-Westphalia","DE","Germany",16, mix(("de",82),("it",7),("fr",5),("ng",3),("in",3))),
 ("de-he-frankfurt","Frankfurt","HE","Hesse","DE","Germany",16, mix(("de",76),("it",7),("in",6),("fr",5),("cn",3),("ng",3))),

 # --- India ---------------------------------------------------------------
 ("in-mh-mumbai","Mumbai","MH","Maharashtra","IN","India",58, mix(("in",94),("gb-en",3),("cn",2),("fr",1))),
 ("in-dl-delhi","Delhi","DL","Delhi","IN","India",56, mix(("in",95),("gb-en",3),("cn",2))),
 ("in-ka-bangalore","Bangalore","KA","Karnataka","IN","India",34, mix(("in",92),("gb-en",4),("us-en",2),("cn",2))),
 ("in-tg-hyderabad","Hyderabad","TG","Telangana","IN","India",28, mix(("in",95),("gb-en",3),("cn",2))),
 ("in-tn-chennai","Chennai","TN","Tamil Nadu","IN","India",26, mix(("in",95),("gb-en",3),("cn",2))),
 ("in-wb-kolkata","Kolkata","WB","West Bengal","IN","India",26, mix(("in",95),("gb-en",3),("cn",2))),

 # --- China ---------------------------------------------------------------
 ("cn-sh-shanghai","Shanghai","SH","Shanghai","CN","China",56, mix(("cn",93),("kr",3),("jp",2),("us-en",2))),
 ("cn-bj-beijing","Beijing","BJ","Beijing","CN","China",54, mix(("cn",94),("kr",3),("jp",2),("us-en",1))),
 ("cn-gd-shenzhen","Shenzhen","GD","Guangdong","CN","China",34, mix(("cn",95),("kr",2),("jp",2),("us-en",1))),
 ("cn-gd-guangzhou","Guangzhou","GD","Guangdong","CN","China",32, mix(("cn",93),("ng",3),("kr",2),("jp",2))),
 ("cn-sc-chengdu","Chengdu","SC","Sichuan","CN","China",26, mix(("cn",96),("kr",2),("jp",2))),
 ("cn-hb-wuhan","Wuhan","HB","Hubei","CN","China",24, mix(("cn",96),("kr",2),("jp",2))),

 # --- South Korea ---------------------------------------------------------
 ("kr-11-seoul","Seoul","11","Seoul","KR","South Korea",44, mix(("kr",90),("cn",5),("jp",3),("us-en",2))),
 ("kr-26-busan","Busan","26","Busan","KR","South Korea",20, mix(("kr",92),("cn",4),("jp",4))),
 ("kr-28-incheon","Incheon","28","Incheon","KR","South Korea",16, mix(("kr",91),("cn",5),("jp",4))),

 # --- France --------------------------------------------------------------
 ("fr-idf-paris","Paris","IDF","Île-de-France","FR","France",46, mix(("fr",72),("ng",12),("it",6),("br-pt",4),("cn",3),("in",3))),
 ("fr-pac-marseille","Marseille","PAC","Provence-Alpes-Côte d'Azur","FR","France",20, mix(("fr",74),("it",10),("ng",10),("mx-es",3),("cn",3))),
 ("fr-ara-lyon","Lyon","ARA","Auvergne-Rhône-Alpes","FR","France",18, mix(("fr",80),("it",8),("ng",6),("cn",3),("in",3))),
 ("fr-occ-toulouse","Toulouse","OCC","Occitanie","FR","France",14, mix(("fr",82),("it",6),("mx-es",5),("ng",4),("cn",3))),
 ("fr-pac-nice","Nice","PAC","Provence-Alpes-Côte d'Azur","FR","France",12, mix(("fr",78),("it",14),("ng",4),("cn",2),("gb-en",2))),

 # --- Italy ---------------------------------------------------------------
 ("it-laz-rome","Rome","LAZ","Lazio","IT","Italy",34, mix(("it",84),("fr",5),("ng",5),("br-pt",3),("cn",3))),
 ("it-lom-milan","Milan","LOM","Lombardy","IT","Italy",30, mix(("it",80),("cn",6),("fr",5),("ng",5),("br-pt",4))),
 ("it-cam-naples","Naples","CAM","Campania","IT","Italy",22, mix(("it",90),("ng",4),("fr",3),("cn",3))),
 ("it-pie-turin","Turin","PIE","Piedmont","IT","Italy",18, mix(("it",86),("fr",6),("ng",4),("cn",4))),
 ("it-tos-florence","Florence","TOS","Tuscany","IT","Italy",14, mix(("it",86),("cn",6),("fr",4),("gb-en",4))),

 # --- Canada --------------------------------------------------------------
 ("ca-on-toronto","Toronto","ON","Ontario","CA","Canada",34, mix(("gb-en",38),("us-en",16),("in",16),("cn",12),("ng",8),("it",6),("fr",4))),
 ("ca-bc-vancouver","Vancouver","BC","British Columbia","CA","Canada",22, mix(("gb-en",38),("cn",22),("us-en",14),("in",12),("kr",8),("jp",6))),
 ("ca-qc-montreal","Montreal","QC","Quebec","CA","Canada",22, mix(("fr",56),("gb-en",18),("it",8),("ng",8),("mx-es",5),("cn",5))),

 # --- Australia -----------------------------------------------------------
 ("au-nsw-sydney","Sydney","NSW","New South Wales","AU","Australia",28, mix(("gb-en",58),("cn",14),("in",12),("it",6),("kr",5),("ng",5))),
 ("au-vic-melbourne","Melbourne","VIC","Victoria","AU","Australia",26, mix(("gb-en",56),("cn",14),("in",12),("it",8),("ng",5),("kr",5))),
 ("au-qld-brisbane","Brisbane","QLD","Queensland","AU","Australia",16, mix(("gb-en",68),("cn",10),("in",10),("kr",6),("it",6))),

 # --- Spain ---------------------------------------------------------------
 ("es-md-madrid","Madrid","MD","Community of Madrid","ES","Spain",30, mix(("mx-es",82),("ng",6),("it",5),("fr",4),("cn",3))),
 ("es-cat-barcelona","Barcelona","CAT","Catalonia","ES","Spain",26, mix(("mx-es",78),("it",8),("fr",6),("ng",4),("cn",4))),
 ("es-vc-valencia","Valencia","VC","Valencian Community","ES","Spain",16, mix(("mx-es",86),("it",5),("fr",4),("ng",3),("cn",2))),

 # --- Argentina -----------------------------------------------------------
 ("ar-c-buenos-aires","Buenos Aires","C","Buenos Aires","AR","Argentina",30, mix(("mx-es",70),("it",20),("de",4),("fr",3),("br-pt",3))),
 ("ar-x-cordoba","Córdoba","X","Córdoba","AR","Argentina",14, mix(("mx-es",76),("it",16),("de",4),("fr",4))),

 # --- South Africa --------------------------------------------------------
 ("za-gp-johannesburg","Johannesburg","GP","Gauteng","ZA","South Africa",24, mix(("ng",56),("gb-en",30),("in",10),("de",2),("fr",2))),
 ("za-wc-cape-town","Cape Town","WC","Western Cape","ZA","South Africa",18, mix(("gb-en",48),("ng",36),("in",8),("de",4),("fr",4))),
]

# ---------------------------------------------------------------- emit -------
root = pathlib.Path('/home/claude/yearafter/packages/content/data')

names = {"$comment": ("Name pools by culture (Ticket 0201). Each entry is one naming tradition "
                      "with a stable id; logic references the id, never the display names "
                      "(CORE_RULES 13). Twelve traditions, ~30 given names per sex and ~34 "
                      "surnames each. Representative, not exhaustive."),
         "entries": []}
problems = []
for cid, (label, male, female, surnames) in CULTURES.items():
    for nm, lst, floor in (("male", male, 30), ("female", female, 30), ("surnames", surnames, 34)):
        if len(lst) < floor: problems.append(f"{cid}.{nm}: {len(lst)} < {floor}")
        if len(set(lst)) != len(lst):
            dupes = [x for x in set(lst) if lst.count(x) > 1]
            problems.append(f"{cid}.{nm}: duplicates {dupes}")
    names["entries"].append({"id": cid, "label": label,
                             "male": male, "female": female,
                             "surnames": [s.replace('_', ' ') for s in surnames]})

locations = {"$comment": ("Birthplace catalog (Ticket 0201). One entry per city, each carrying its "
                          "region and country so a birth is a single weighted draw — nesting "
                          "country/region/city would misweight countries by how many of their "
                          "cities happen to be catalogued. `weight` is a birth-likelihood weight, "
                          "loosely population-shaped, NOT a population. `nameCultures` is the mix a "
                          "character born there draws a name from; every city has a mix, because "
                          "every real city does. US weight is dominant while salary, property and "
                          "price content is US-benchmarked — a content gap, not a design statement."),
             "entries": []}
seen = set()
# US weights are scaled up so US births stay the plurality (~45%) while the
# economy content is US-benchmarked. One number, in one place, to change later.
US_BIAS = 1.45
for (cid, city, rc, region, cc, country, weight, m) in CITIES:
    if cc == 'US': weight = round(weight * US_BIAS)
    if cid in seen: problems.append(f"duplicate city id {cid}")
    seen.add(cid)
    for e in m:
        if e["culture"] not in CULTURES: problems.append(f"{cid} -> unknown culture {e['culture']}")
    locations["entries"].append({"id": cid, "city": city, "regionCode": rc, "region": region,
                                 "countryCode": cc, "country": country, "weight": weight,
                                 "nameCultures": m})

if problems:
    print("PROBLEMS:"); [print("  " + p) for p in problems]; raise SystemExit(1)

(root / 'names.json').write_text(json.dumps(names, indent=2, ensure_ascii=False) + '\n')
(root / 'locations.json').write_text(json.dumps(locations, indent=2, ensure_ascii=False) + '\n')

total_names = sum(len(c[1]) + len(c[2]) + len(c[3]) for c in CULTURES.values())
us = sum(round(c[6]*US_BIAS) for c in CITIES if c[4] == 'US'); allw = sum((round(c[6]*US_BIAS) if c[4]=='US' else c[6]) for c in CITIES)
print(f"cultures: {len(CULTURES)}   names: {total_names}")
print(f"cities: {len(CITIES)}   countries: {len(set(c[4] for c in CITIES))}")
print(f"US birth share: {us/allw:.1%}")
