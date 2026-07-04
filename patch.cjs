const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');
const insertString = `
  // Track app activity for motoristas
  useEffect(() => {
    if (currentUser?.profile === UserProfile.Motorista) {
      
      // Update persistent status in database, silently catch error if column missing
      supabase.from('drivers').update({ has_app: true }).eq('id', currentUser.id).then(({error}) => {
         if (error) console.log("has_app column might not exist yet", error);
      });

      const channel = supabase.channel('driver_tracking', {
        config: { presence: { key: currentUser.id } },
      });
      channel.on('presence', { event: 'sync' }, () => {});
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ driverName: currentUser.name, isAppActive: true });
        }
      });
      return () => {
        channel.untrack();
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser]);

`;

// Just replace the old block with the new one
const searchRegex = /\/\/ Track app activity for motoristas[\s\S]*?\}, \[currentUser\]\);/;
if (searchRegex.test(code)) {
    code = code.replace(searchRegex, insertString.trim());
    fs.writeFileSync('App.tsx', code);
    console.log('Re-patched App.tsx successfully');
} else {
    console.log('Could not find the target code to replace.');
}
