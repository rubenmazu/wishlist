# Requirements Document

## Introduction

Feature-ul "private-gift-layer" extinde wishlist-ul partajat al celor doi utilizatori (Marta și Ruben) cu un strat privat de planificare a cadourilor, plus îmbunătățiri de organizare și de experiență valabile peste tot. Scara e mică (doi oameni), deci soluțiile rămân simple și păstrează stilul actual: Next.js App Router, Server Actions, Turso/libSQL, auth cu cookie semnat.

Principiul central: **tot ce ține de stratul privat se leagă de viewer-ul curent (cine se uită), nu de owner-ul listei.** Partenerul nu vede niciodată marcajele "cumpărat", reordonarea personală, ideile de cadou private sau notițele private ale celuilalt. Lista fiecăruia, din propria perspectivă, rămâne curată exact ca acum.

Feature-ul acoperă trei zone:
1. Îmbunătățiri pe lista proprie (reordonare, prioritate).
2. Stratul privat peste lista partenerului (marcaj cumpărat, reordonare personală, idei de cadou private, notițe private).
3. Funcții generale peste tot (sortare, copiere/deschidere link, buget total, PWA, confirmare la ștergere).

Interfața rămâne în limba română, minimalistă, în stil Apple, cu temă light/dark automată (deja existentă).

## Glossary

- **Sistem**: Aplicația wishlist (frontend Next.js + Server Actions + bază de date libSQL) tratată ca un întreg.
- **Viewer**: Utilizatorul autentificat curent, din a cărui perspectivă se afișează datele.
- **Owner**: Utilizatorul proprietar al unei liste de produse (profilul căruia îi aparțin produsele).
- **Produs**: O intrare din wishlist aparținând unui owner, cu câmpurile title, url, price (RON), note, created_at.
- **Lista_Proprie**: Lista de produse unde Viewer este și Owner.
- **Lista_Partenerului**: Lista de produse al cărei Owner este celălalt utilizator decât Viewer.
- **Strat_Privat**: Totalitatea datelor legate de un Viewer peste Lista_Partenerului (marcaj cumpărat, ordine personală, idei de cadou private, notițe private), vizibile exclusiv acelui Viewer.
- **Marcaj_Cumparat**: Un indicator privat prin care Viewer semnalează că a cumpărat/rezervat un produs din Lista_Partenerului.
- **Idee_Cadou**: O intrare privată adăugată de Viewer în contextul Listei_Partenerului, cu aceleași câmpuri ca un Produs, vizibilă doar Viewer-ului care a creat-o.
- **Nota_Privata**: Un text liber atașat de Viewer unui produs din Lista_Partenerului, vizibil doar acelui Viewer.
- **Prioritate**: Marcaj "îmi doresc tare asta" aplicat de Owner pe propriile produse.
- **Ordine_Personala**: Poziția dintr-o listă, definită separat pentru fiecare Viewer; Owner-ul vede ordinea proprie, Viewer-ul vede ordinea lui peste Lista_Partenerului.
- **Buget_Total**: Suma prețurilor intrărilor afișate într-o listă.
- **PWA**: Progressive Web App — aplicație instalabilă pe ecranul principal al telefonului, care se deschide fullscreen.

## Requirements

### Requirement 1: Reordonare pe lista proprie

**User Story:** Ca Owner, vreau să-mi rearanjez propriile produse în ordinea dorită, ca să pun în față ce contează mai mult pentru mine.

#### Acceptance Criteria

1. WHEN Viewer vizualizează Lista_Proprie, THE Sistem SHALL afișa produsele în Ordine_Personala a Owner-ului.
2. WHEN Viewer mută un produp propriu într-o poziție nouă din Lista_Proprie, THE Sistem SHALL salva noua Ordine_Personala și afișa produsele în acea ordine la următoarea încărcare.
3. WHEN Sistem încarcă Lista_Proprie, THE Sistem SHALL detecta suportul de drag-and-drop al dispozitivului și afișa reordonarea prin drag-and-drop acolo unde există suport, respectiv controale de mutare sus/jos acolo unde nu există suport.
4. IF o operație de reordonare eșuează la salvare, THEN THE Sistem SHALL păstra ordinea anterioară și afișa un mesaj de eroare în limba română.

### Requirement 2: Prioritate pe produsele proprii

**User Story:** Ca Owner, vreau să marchez un produs ca "îmi doresc tare asta", ca partenerul să vadă ce îmi doresc cel mai mult.

#### Acceptance Criteria

1. WHEN Viewer activează Prioritate pe un produs propriu, THE Sistem SHALL salva Prioritate pentru acel produs.
2. WHEN Viewer dezactivează Prioritate pe un produs propriu, THE Sistem SHALL elimina Prioritate pentru acel produs.
3. WHILE un produs are Prioritate activă, THE Sistem SHALL afișa un marcaj vizual distinct pe produs în orice listă unde produsul apare.
4. WHEN partenerul vizualizează Lista_Partenerului (adică lista acestui Owner), THE Sistem SHALL afișa marcajul de Prioritate setat de Owner.

### Requirement 3: Marcaj "cumpărat" privat pe lista partenerului

**User Story:** Ca Viewer, vreau să marchez privat un produs din lista partenerului ca fiind cumpărat de mine, ca să nu-l iau de două ori, fără ca partenerul să afle.

#### Acceptance Criteria

1. WHEN Viewer activează Marcaj_Cumparat pe un produs din Lista_Partenerului, THE Sistem SHALL asocia Marcaj_Cumparat cu perechea (viewer, produs).
2. WHILE un produs are Marcaj_Cumparat activ pentru Viewer, THE Sistem SHALL afișa produsul la finalul Listei_Partenerului în perspectiva Viewer-ului.
3. WHILE un produs are Marcaj_Cumparat activ pentru Viewer, THE Sistem SHALL afișa produsul estompat și tăiat, însoțit de un semn de "cumpărat", în perspectiva Viewer-ului.
4. WHEN Viewer dezactivează Marcaj_Cumparat pe un produs, THE Sistem SHALL elimina asocierea și reda produsul în aspect normal în perspectiva Viewer-ului.
5. WHEN Owner-ul vizualizează propria listă, THE Sistem SHALL afișa produsul fără niciun indiciu despre Marcaj_Cumparat setat de Viewer.

### Requirement 4: Reordonare personală privată a listei partenerului

**User Story:** Ca Viewer, vreau să rearanjez lista partenerului în ordinea mea de planificare, fără ca el să vadă această ordine.

#### Acceptance Criteria

1. WHEN Viewer mută un produs din Lista_Partenerului într-o poziție nouă, THE Sistem SHALL salva Ordine_Personala a Viewer-ului pentru acea listă.
2. WHEN Viewer vizualizează Lista_Partenerului, THE Sistem SHALL afișa produsele în Ordine_Personala a Viewer-ului, cu produsele marcate cumpărat la final conform Requirement 3.
3. WHEN Owner-ul vizualizează propria listă, THE Sistem SHALL afișa produsele în Ordine_Personala a Owner-ului, neafectată de Ordine_Personala a Viewer-ului.
4. WHERE un produs nou este adăugat de Owner după ce Viewer și-a stabilit Ordine_Personala, THE Sistem SHALL afișa produsul nou într-o poziție determinată de data adăugării până când Viewer îl repoziționează.

### Requirement 5: Idei de cadou private pe lista partenerului

**User Story:** Ca Viewer, vreau să adaug idei de cadou private în lista partenerului, ca să-mi notez propuneri pe care doar eu le văd.

#### Acceptance Criteria

1. WHEN Viewer adaugă o Idee_Cadou în contextul Listei_Partenerului cu un title ne-gol, THE Sistem SHALL salva Idee_Cadou cu câmpurile title, url, price și note și o va asocia cu Viewer-ul și cu Owner-ul listei.
2. WHEN Viewer vizualizează Lista_Partenerului, THE Sistem SHALL afișa propriile Idee_Cadou distincte vizual față de produsele Owner-ului.
3. WHEN Owner-ul vizualizează propria listă, THE Sistem SHALL afișa lista fără nicio Idee_Cadou creată de Viewer.
4. WHEN Viewer editează o Idee_Cadou proprie, THE Sistem SHALL salva valorile actualizate ale câmpurilor title, url, price și note.
5. WHEN Viewer șterge o Idee_Cadou proprie, THE Sistem SHALL elimina acea Idee_Cadou din perspectiva Viewer-ului.
6. IF Viewer trimite o Idee_Cadou cu title gol, THEN THE Sistem SHALL respinge salvarea și păstra starea anterioară.

### Requirement 6: Notițe private pe produsele partenerului

**User Story:** Ca Viewer, vreau să atașez notițe private produselor partenerului, ca să-mi rețin detalii de cadou pe care doar eu le văd.

#### Acceptance Criteria

1. WHEN Viewer salvează o Nota_Privata pe un produs din Lista_Partenerului, THE Sistem SHALL asocia Nota_Privata cu perechea (viewer, produs).
2. WHEN Viewer vizualizează un produs din Lista_Partenerului care are Nota_Privata, THE Sistem SHALL afișa Nota_Privata distinct față de nota publică a Owner-ului.
3. WHEN Viewer modifică o Nota_Privata existentă, THE Sistem SHALL salva textul actualizat.
4. WHEN Viewer golește textul unei Nota_Privata, THE Sistem SHALL elimina Nota_Privata pentru acea pereche (viewer, produs).
5. WHEN Owner-ul vizualizează propria listă, THE Sistem SHALL afișa produsul fără nicio Nota_Privata setată de Viewer.

### Requirement 7: Izolarea stratului privat între utilizatori

**User Story:** Ca utilizator, vreau garanția că stratul meu privat rămâne doar al meu, ca planificarea cadourilor să rămână o surpriză.

#### Acceptance Criteria

1. THE Sistem SHALL lega fiecare element din Strat_Privat de identitatea Viewer-ului care l-a creat.
2. WHEN Sistem încarcă date pentru un Viewer, THE Sistem SHALL include din Strat_Privat doar elementele al căror viewer corespunde Viewer-ului curent.
3. IF o cerere încearcă să citească sau să modifice un element din Strat_Privat care aparține altui Viewer, THEN THE Sistem SHALL respinge operația.
4. WHEN Owner-ul vizualizează propria listă, THE Sistem SHALL afișa exclusiv propriile produse și propriile marcaje publice (Prioritate, Ordine_Personala a Owner-ului).

### Requirement 8: Sortarea listelor

**User Story:** Ca Viewer, vreau să sortez o listă după preț, dată sau prioritate, ca să găsesc rapid ce caut, fără un UI aglomerat.

#### Acceptance Criteria

1. WHERE Viewer alege sortarea după preț, THE Sistem SHALL afișa intrările în ordine crescătoare după price, cu intrările fără price la final.
2. WHERE Viewer alege sortarea după data adăugării, THE Sistem SHALL afișa intrările ordonate după created_at descrescător.
3. WHERE Viewer alege sortarea după prioritate, THE Sistem SHALL afișa intrările cu Prioritate înaintea celor fără Prioritate.
4. THE Sistem SHALL expune controlul de sortare printr-un element de interfață minimal, fără a afișa permanent câmpuri auxiliare precum created_at.
5. WHILE o sortare este activă, THE Sistem SHALL menține produsele cu Marcaj_Cumparat la finalul Listei_Partenerului în perspectiva Viewer-ului.

### Requirement 9: Acțiuni pe link-ul produsului

**User Story:** Ca Viewer, vreau să copiez sau să deschid link-ul unui produs, ca să ajung repede la magazin.

#### Acceptance Criteria

1. WHERE o intrare afișată are un url, THE Sistem SHALL oferi o acțiune de deschidere a url-ului într-un tab nou.
2. WHERE o intrare afișată are un url, THE Sistem SHALL oferi o acțiune de copiere a url-ului în clipboard.
3. WHEN Viewer declanșează copierea url-ului, THE Sistem SHALL copia url-ul și afișa o confirmare vizuală scurtă în limba română.
4. IF copierea în clipboard eșuează, THEN THE Sistem SHALL afișa un mesaj care indică faptul că operația nu a reușit.

### Requirement 10: Buget total pe listă

**User Story:** Ca Viewer, vreau să văd suma prețurilor dintr-o listă, ca să am o imagine rapidă a bugetului.

#### Acceptance Criteria

1. WHEN Viewer vizualizează o listă, THE Sistem SHALL calcula Buget_Total ca suma câmpurilor price ale intrărilor afișate.
2. WHILE o intrare afișată are price lipsă, THE Sistem SHALL exclude acea intrare din Buget_Total.
3. THE Sistem SHALL afișa Buget_Total formatat ca valoare RON conform formatării locale ro-RO.
4. WHEN setul de intrări afișate se modifică, THE Sistem SHALL recalcula Buget_Total pentru setul curent afișat.

### Requirement 11: Confirmare la ștergere

**User Story:** Ca Viewer, vreau o confirmare înainte de ștergere, ca să nu pierd din greșeală o intrare.

#### Acceptance Criteria

1. WHEN Viewer declanșează ștergerea unei intrări, THE Sistem SHALL cere o confirmare explicită înainte de a șterge.
2. WHEN Viewer confirmă ștergerea, THE Sistem SHALL șterge intrarea și actualiza lista afișată.
3. WHEN Viewer anulează confirmarea, THE Sistem SHALL păstra intrarea neschimbată.

### Requirement 12: Instalare și deschidere ca PWA

**User Story:** Ca Viewer, vreau să instalez aplicația pe ecranul principal al telefonului, ca să o deschid rapid, fullscreen, ca o aplicație nativă.

#### Acceptance Criteria

1. THE Sistem SHALL expune un manifest web care definește numele aplicației, iconurile și modul de afișare fullscreen (standalone).
2. WHERE browserul suportă instalarea, THE Sistem SHALL permite adăugarea aplicației pe ecranul principal al dispozitivului.
3. WHEN aplicația instalată este deschisă de pe ecranul principal, THE Sistem SHALL afișa interfața în mod fullscreen, fără bara de adrese a browserului.
4. THE Sistem SHALL înregistra un service worker minimal activ care permite instalarea aplicației la fiecare încărcare a aplicației.
