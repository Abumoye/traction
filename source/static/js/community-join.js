/* =========================================================
   ATH Recruiters — Join ATH Job Community form
   Used on /brands/recruiters/join-ath-community/.

   Posts to a Google Apps Script Web App (the same script that used to
   serve this form directly from script.google.com) using the same
   no-cors + text/plain pattern already used by /js/lead-form.js
   elsewhere on this site, extended to carry the CV and photo as
   base64-encoded data (a plain fetch cannot send native File objects
   the way Apps Script's own google.script.run bridge could).

   SETUP REQUIRED: replace COMMUNITY_JOIN_SCRIPT_URL below with the
   Web App URL from redeploying the ATH Job Community Apps Script
   project. See /docs/ath-community-form-setup.md for the full guide
   and the updated Apps Script code to paste in.

   Because the request uses mode: 'no-cors' (required so the browser
   doesn't block the cross-origin POST), the response body can't be
   read back -- so unlike the old google.script.run flow, this page
   can't show the Member Code the moment the form is submitted. The
   confirmation email Apps Script already sends contains the Member
   Code and the community link, so the on-page message below points
   people there instead.
   ========================================================= */

const COMMUNITY_JOIN_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwd0xvVLA8ODm86rmaKhawIkvweVXVa-yP2edfUxiPrLDgrK_pr2rOQZfqRW7TPjmaQSA/exec";
const COMMUNITY_JOIN_MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB per file
const COMMUNITY_JOIN_SUPPORT_WHATSAPP = "https://wa.me/2348125078087";

const NIGERIA_STATES_LGAS = {
  "Abia": ["Aba North","Aba South","Arochukwu","Bende","Ikwuano","Isiala Ngwa North","Isiala Ngwa South","Isuikwuato","Obi Ngwa","Ohafia","Osisioma","Ugwunagbo","Ukwa East","Ukwa West","Umuahia North","Umuahia South","Umu Nnochi"],
  "Adamawa": ["Demsa","Fufure","Ganye","Girei","Gombi","Guyuk","Hong","Jada","Lamurde","Madagali","Maiha","Mayo Belwa","Michika","Mubi North","Mubi South","Numan","Shelleng","Song","Toungo","Yola North","Yola South"],
  "Akwa Ibom": ["Abak","Eastern Obolo","Eket","Esit Eket","Essien Udim","Etim Ekpo","Etinan","Ibeno","Ibesikpo Asutan","Ibiono Ibom","Ika","Ikono","Ikot Abasi","Ikot Ekpene","Ini","Itu","Mbo","Mkpat Enin","Nsit Atai","Nsit Ibom","Nsit Ubium","Obot Akara","Okobo","Onna","Oron","Oruk Anam","Oyot","Ukanafun","Uruan","Urue Offong Oruko","Uyo"],
  "Anambra": ["Aguata","Anambra East","Anambra West","Anaocha","Awka North","Awka South","Ayamelum","Dunukofia","Ekwusigo","Idemili North","Idemili South","Ihiala","Njikoka","Nnewi North","Nnewi South","Ogbaru","Onitsha North","Onitsha South","Orumba North","Orumba South","Oyi"],
  "Bauchi": ["Alkaleri","Bauchi","Bogoro","Damban","Darazo","Dass","Gamawa","Ganjuwa","Giade","Itas Gadau","Jama'are","Katagum","Kirfi","Misau","Ningi","Shira","Tafawa Balewa","Toro","Warji","Zaki"],
  "Bayelsa": ["Brass","Ekeremor","Kolokuma Opokuma","Nembe","Ogbia","Sagbama","Southern Jaw","Yenagoa"],
  "Benue": ["Ado","Agatu","Apa","Buruku","Gboko","Guma","Gwer East","Gwer West","Katsina Ala","Konshisha","Kwande","Logo","Makurdi","Obi","Ogbadibo","Ohimini","Oju","Okpokwu","Otukpo","Tarka","Ukum","Ushongo","Vandeikya"],
  "Borno": ["Abadam","Askira Uba","Bama","Bayo","Biu","Chibok","Damboa","Dikwa","Gubio","Guzamala","Gwoza","Hawul","Jere","Kaga","Kala Balge","Konduga","Kukawa","Kwaya Kusar","Mafa","Magumeri","Mainok","Marte","Mobbar","Monguno","Ngala","Nganzai","Shani"],
  "Cross River": ["Abi","Akamkpa","Akpabuyo","Bakassi","Bekwarra","Biase","Boki","Calabar Municipal","Calabar South","Etung","Ikom","Obanliku","Obubra","Obudu","Odukpani","Ogoja","Yakurr","Yala"],
  "Delta": ["Aniocha North","Aniocha South","Bomadi","Burutu","Ethiope East","Ethiope West","Ika North East","Ika South","Isoko North","Isoko South","Ndokwa East","Ndokwa West","Okpe","Oshimili North","Oshimili South","Patani","Sapele","Udu","Ughelli North","Ughelli South","Ukwuani","Uvwie","Warri North","Warri South","Warri South West"],
  "Ebonyi": ["Abakaliki","Afikpo North","Afikpo South","Ebonyi","Ezza North","Ezza South","Ikwo","Ishielu","Ivo","Izzi","Ohaozara","Ohaukwu","Onicha"],
  "Edo": ["Akoko Edo","Egor","Esan Central","Esan North East","Esan South East","Esan West","Etsako Central","Etsako East","Etsako West","Igueben","Ikpoba Okha","Oredo","Orhionmwon","Ovia North East","Ovia South West","Owan East","Owan West","Uhunmwonde"],
  "Ekiti": ["Ado Ekiti","Efon","Ekiti East","Ekiti West","Ekiti South West","Emure","Gbonyin","Ido Osi","Ijero","Ikere","Ikole","Ilejemeje","Irepodun Ifelodun","Ise Orun","Moba","Oye"],
  "Enugu": ["Aninri","Awgu","Enugu East","Enugu North","Enugu South","Ezeagu","Igbo Etiti","Igbo Eze North","Igbo Eze South","Isi Uzo","Nkanu East","Nkanu West","Nsukka","Oji River","Udenu","Udi","Uzo Uwani"],
  "Federal Capital Territory": ["Abaji","Bwari","Gwagwalada","Kuje","Kwali","Municipal Area Council"],
  "Gombe": ["Akko","Balanga","Billiri","Dukku","Funakaye","Gombe","Kaltungo","Kwami","Shongom","Tafawa Balewa","Yamaltu Deba"],
  "Imo": ["Aboh Mbaise","Ahiazu Mbaise","Ehime Mbano","Ezinihitte","Ideato North","Ideato South","Ihitte Uboma","Ikeduru","Isialu Mbano","Isu","Mbaitoli","Ngor Okpala","Njaba","Nwangele","Nkwerre","Obowo","Oguta","Ohaji Egbema","Okigwe","Orlu","Orsu","Oru East","Oru West","Owerri Municipal","Owerri North","Owerri West"],
  "Jigawa": ["Auyo","Babura","Biriniwa","Birnin Kudu","Buji","Dutse","Gagarawa","Garki","Gumel","Guri","Gwaram","Gwiwa","Hadejia","Jahun","Kafin Hausa","Kaugama","Kazaure","Kiri Kasama","Kiyawa","Maigatari","Malam Madori","Miga","Ringim","Roni","Sule Tankarkar","Taura","Yankwashi"],
  "Kaduna": ["Birnin Gwari","Chikun","Giwa","Igabi","Ikara","Jaba","Jema'a","Kachia","Kaduna North","Kaduna South","Kagarko","Kajuru","Kaura","Kauru","Kubau","Kudan","Lere","Makarfi","Sabon Gari","Sanga","Soba","Zangon Kataf","Zaria"],
  "Kano": ["Ajingi","Albasu","Bagwai","Bebeji","Bichi","Bunkure","Dala","Dambatta","Dawakin Kudu","Dawakin Tofa","Doguwa","Fagge","Gabasawa","Garko","Garun Mallam","Gaya","Gezawa","Gwale","Gwarzo","Kabo","Kano Municipal","Karaye","Kibiya","Kiru","Kumbotso","Kunchi","Kura","Madobi","Makoda","Minjibir","Nasarawa","Rano","Rimin Gado","Rogo","Shanono","Sumaila","Takai","Tarauni","Tofa","Tsanyawa","Tudun Wada","Ungogo","Warawa","Wudil"],
  "Katsina": ["Bakori","Batagarawa","Batsari","Baure","Bindawa","Charanchi","Dandume","Danja","Dan Musa","Daura","Dutsi","Dutsin Ma","Faskari","Funtua","Ingawa","Jibia","Kafur","Kaita","Kankara","Kankia","Katsina","Kurfi","Kusada","Mai'Adua","Malumfashi","Mani","Mashi","Matazu","Musawa","Rimi","Sabuwa","Safana","Sandamu","Zango"],
  "Kebbi": ["Aleiro","Arewa Dandi","Argungu","Augie","Bagudo","Birnin Kebbi","Bunza","Dandi","Fakai","Gwandu","Jega","Kalgo","Koko Besse","Maiyama","Ngaski","Sakaba","Shanga","Suru","Wasagu Danko","Yauri","Zuru"],
  "Kogi": ["Adavi","Ajaokuta","Ankpa","Bassa","Dekina","Ibaji","Idah","Igalamela Odolu","Ijumu","Kabba Bunu","Kogi","Lokoja","Mopa Muro","Ofu","Ogori Magongo","Okehi","Okene","Olamaboro","Omala","Yagba East","Yagba West"],
  "Kwara": ["Asa","Baruten","Edu","Ekiti","Ifelodun","Ilorin East","Ilorin South","Ilorin West","Irepodun","Isin","Kaiama","Moro","Offa","Oke Ero","Oyun","Pategi"],
  "Lagos": ["Agege","Ajeromi-Ifelodun","Alimosho","Amuwo-Odofin","Apapa","Badagry","Epe","Eti-Osa","Ibeju-Lekki","Ifako-Ijaiye","Ikeja","Ikorodu","Kosofe","Lagos Island","Lagos Mainland","Mushin","Ojo","Oshodi-Isolo","Shomolu","Surulere"],
  "Nasarawa": ["Akwanga","Awe","Doma","Karu","Keana","Keffi","Kokona","Lafia","Nasarawa","Nasarawa Eggon","Obi","Toto","Wamba"],
  "Niger": ["Agaie","Agwara","Bida","Borgu","Bosso","Chanchaga","Edati","Gbako","Gurara","Katcha","Kontagora","Lapai","Lavun","Magama","Mariga","Mashegu","Mokwa","Munya","Paikoro","Rafi","Rijau","Shiroro","Suleja","Tafa","Wushishi"],
  "Ogun": ["Abeokuta North","Abeokuta South","Ado-Odo Ota","Egbado North","Egbado South","Ewekoro","Ifo","Ijebu East","Ijebu North","Ijebu North East","Ijebu Ode","Ikenne","Imeko Afon","Ipokia","Obafemi Owode","Odeda","Odogbolu","Ogun Waterside","Remo North","Sagamu","Yewa North","Yewa South"],
  "Ondo": ["Akoko North East","Akoko North West","Akoko South East","Akoko South West","Akure North","Akure South","Ese Odo","Idanre","Ifedore","Ilaje","Ile Oluji Okeigbo","Irele","Odigbo","Okitipupa","Ondo East","Ondo West","Ose","Owo"],
  "Osun": ["Aiyedade","Aiyedire","Atakunmosa East","Atakunmosa West","Boluwaduro","Boripe","Ede North","Ede South","Egbeda","Ejigbo","Ife Central","Ife East","Ife North","Ife South","Ifedayo","Ifelodun","Ila","Ilesa East","Ilesa West","Irepodun","Iwo","Obokun","Odo Otin","Ola Oluwa","Olorunda","Oriade","Orolu","Osogbo"],
  "Oyo": ["Afijio","Akinyele","Atiba","Atisbo","Egbeda","Ibadan North","Ibadan North East","Ibadan North West","Ibadan South East","Ibadan South West","Ibarapa Central","Ibarapa East","Ibarapa North","Ido","Irepo","Iseyin","Itesiwaju","Iwajowa","Kajola","Lagelu","Ogbomosho North","Ogbomosho South","Ogo Oluwa","Olorunsogo","Oluyole","Ona Ara","Orelope","Ori Ire","Oyo East","Oyo West","Saki East","Saki West","Surulere"],
  "Plateau": ["Barkin Ladi","Bassa","Bokkos","Jos East","Jos North","Jos South","Kanam","Kanke","Langtang North","Langtang South","Mangu","Mikang","Pankshin","Qua'an Pan","Riyom","Shendam","Wase"],
  "Rivers": ["Abua Odual","Ahoada East","Ahoada West","Akuku Toru","Andoni","Asari Toru","Bonny","Degema","Eleme","Emohua","Etche","Gokana","Ikwerre","Khana","Obio Akpor","Ogba Egbema Ndoni","Ogu Bolo","Okrika","Omuma","Opobo Nkoro","Oyigbo","Port Harcourt","Tai"],
  "Sokoto": ["Binji","Bodinga","Dange Shuni","Gada","Goronyo","Gudu","Gwadabawa","Illela","Isa","Kebbe","Kware","Rabah","Sabon Birni","Shagari","Silame","Sokoto North","Sokoto South","Tambuwal","Tangaza","Tureta","Wamako","Wurno","Yabo"],
  "Taraba": ["Ardo Kola","Bali","Donga","Gashaka","Gassol","Ibi","Jalingo","Karim Lamido","Kurmi","Lau","Sardauna","Takum","Ussa","Wukari","Yorro","Zing"],
  "Yobe": ["Bade","Bursari","Damaturu","Fika","Fune","Geidam","Gujba","Gulani","Jakusko","Karasuwa","Machina","Nangere","Nguru","Potiskum","Tarmuwa","Yunusari","Yusufari"],
  "Zamfara": ["Anka","Bakura","Birnin Magaji","Bukkuyum","Bungudu","Gummi","Gusau","Isa","Kaura Namoda","Kiyawa","Maradun","Maru","Shinkafi","Talata Mafara","Tsafe","Zurmi"]
};

function populateStates() {
  const select = document.getElementById('cjState');
  if (!select) return;
  Object.keys(NIGERIA_STATES_LGAS).sort().forEach(function (state) {
    const opt = document.createElement('option');
    opt.value = state;
    opt.textContent = state;
    select.appendChild(opt);
  });
}

function updateLGAs() {
  const state = document.getElementById('cjState').value;
  const lgaSelect = document.getElementById('cjCity');
  lgaSelect.innerHTML = '<option value="" disabled selected>Select LGA</option>';
  if (NIGERIA_STATES_LGAS[state]) {
    NIGERIA_STATES_LGAS[state].forEach(function (lga) {
      const opt = document.createElement('option');
      opt.value = lga;
      opt.textContent = lga;
      lgaSelect.appendChild(opt);
    });
  }
}

// Reads a File as a base64 string (without the "data:...;base64," prefix),
// since that's the format Utilities.base64Decode expects on the Apps
// Script side.
function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      const result = reader.result;
      const base64 = result.substring(result.indexOf(',') + 1);
      resolve({ filename: file.name, mimeType: file.type || 'application/octet-stream', base64: base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('communityJoinForm');
  if (!form) return;

  populateStates();
  document.getElementById('cjState').addEventListener('change', updateLGAs);

  const submitBtn = document.getElementById('communityJoinSubmitBtn');
  const statusEl = document.getElementById('communityJoinStatus');
  const defaultBtnText = submitBtn.innerText;

  function showError(message) {
    statusEl.innerHTML = message;
    statusEl.style.color = '#c0392b';
    submitBtn.disabled = false;
    submitBtn.innerText = defaultBtnText;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    statusEl.textContent = '';

    if (COMMUNITY_JOIN_SCRIPT_URL.indexOf('REPLACE_WITH') === 0) {
      showError('This form is not fully set up yet. Please reach us on <a href="' + COMMUNITY_JOIN_SUPPORT_WHATSAPP + '" target="_blank" rel="noopener">WhatsApp</a> instead.');
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const cvFile = document.getElementById('cjCv').files[0];
    const photoFile = document.getElementById('cjPhoto').files[0];

    if (cvFile.size > COMMUNITY_JOIN_MAX_FILE_BYTES) {
      showError('Your CV is larger than 8MB. Please upload a smaller file and try again.');
      return;
    }
    if (photoFile.size > COMMUNITY_JOIN_MAX_FILE_BYTES) {
      showError('Your photograph is larger than 8MB. Please upload a smaller file and try again.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = 'Submitting Application...';

    Promise.all([fileToBase64(cvFile), fileToBase64(photoFile)])
      .then(function (files) {
        const payload = {
          formType: 'ath-community-join',
          fullName: form.fullName.value.trim(),
          gender: form.gender.value,
          phone: form.phone.value.trim(),
          email: form.email.value.trim(),
          dob: form.dob.value,
          highestDegree: form.highestDegree.value,
          state: form.state.value,
          city: form.city.value,
          tiktok: form.tiktok.value.trim(),
          instagram: form.instagram.value.trim(),
          linkedin: form.linkedin.value.trim(),
          cv: files[0],
          photo: files[1]
        };

        return fetch(COMMUNITY_JOIN_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      })
      .then(function () {
        statusEl.innerHTML = 'Application submitted! Check your email for your Member Code and the link to join the community.';
        statusEl.style.color = '#1e7e34';
        submitBtn.innerText = defaultBtnText;
        submitBtn.disabled = false;
        form.reset();
        document.getElementById('cjCity').innerHTML = '<option value="" disabled selected>Select LGA</option>';
      })
      .catch(function () {
        showError('Something went wrong submitting your application. Please try again or reach us on <a href="' + COMMUNITY_JOIN_SUPPORT_WHATSAPP + '" target="_blank" rel="noopener">WhatsApp</a>.');
      });
  });
});
