const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Fix 1: Add drivers to ShipmentHistoryPage call
const searchRegex = /return <ShipmentHistoryPage\s+shipments=\{visibleShipments\}\s+cargos=\{cargos\}\s+users=\{users\}/g;
code = code.replace(searchRegex, 'return <ShipmentHistoryPage\n                  shipments={visibleShipments}\n                  cargos={cargos}\n                  drivers={drivers}\n                  users={users}');

// Fix 2: Change the spinner condition  
code = code.replace(
  'if (isAuthChecking || (isLoading && shipments.length === 0 && cargos.length === 0))',
  'if (isAuthChecking || isLoading)'
);

// Fix 3: Add driver tracking useEffect after the isAnyModalActiveRef effect
const insertAfter = 'isAnyModalActiveRef.current = isAnyModalActive;\n  }, [isAnyModalActive, isAnyModalActiveRef]);';
const trackingCode = `

  // Track app activity for motoristas
  useEffect(() => {
    if (currentUser?.profile === UserProfile.Motorista) {
      // Update persistent status in database
      supabase.from('drivers').update({ has_app: true }).eq('id', currentUser.id).then(({error}) => {
         if (error) console.log('has_app column might not exist yet', error);
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
  }, [currentUser]);`;

if (code.includes(insertAfter)) {
  code = code.replace(insertAfter, insertAfter + trackingCode);
} else {
  console.log('WARNING: insertAfter not found, skipping tracking code');
}

fs.writeFileSync('App.tsx', code);
console.log('App.tsx patched successfully.');
console.log('Tracker present:', code.includes('Track app activity for motoristas'));
console.log('ShipmentHistoryPage has drivers:', code.includes('drivers={drivers}\n                  users={users}'));
console.log('Spinner condition fixed:', code.includes('if (isAuthChecking || isLoading)'));
