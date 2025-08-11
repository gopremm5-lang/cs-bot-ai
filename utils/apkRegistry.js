// utils/apkRegistry.js
// Registry kebutuhan per APK (sifatnya disarankan, bukan wajib)

module.exports = {
  youtube : { suggestServiceEmail: true,  suggestInviteEmail: true  },
  netflix : { suggestServiceEmail: true,  suggestInviteEmail: false },
  disney  : { suggestServiceEmail: true,  suggestInviteEmail: false },
  'disney+':{ suggestServiceEmail: true,  suggestInviteEmail: false },
  viu     : { suggestServiceEmail: true,  suggestInviteEmail: false },
  'hbo max':{ suggestServiceEmail: true,  suggestInviteEmail: false },
  iqiyi   : { suggestServiceEmail: true,  suggestInviteEmail: false },
  vidio   : { suggestServiceEmail: true,  suggestInviteEmail: false },
  'vision+':{ suggestServiceEmail: true,  suggestInviteEmail: false },
  wetv    : { suggestServiceEmail: true,  suggestInviteEmail: false },
  canva   : { suggestServiceEmail: true,  suggestInviteEmail: false },
  capcut  : { suggestServiceEmail: true,  suggestInviteEmail: false },
  remini  : { suggestServiceEmail: true,  suggestInviteEmail: false },
  picsart : { suggestServiceEmail: true,  suggestInviteEmail: false },

  // default untuk APK lain
  default : { suggestServiceEmail: true, suggestInviteEmail: false }
};
