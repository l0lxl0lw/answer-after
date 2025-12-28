#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Utility script to create ElevenLabs agents for existing organizations
 * Usage: deno run --allow-net --allow-env scripts/setup-elevenlabs-agents.ts [organization_id]
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Load environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ELEVENLABS_API_KEY) {
  console.error('Missing required environment variables:');
  console.error('- SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  console.error('- ELEVENLABS_API_KEY');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createElevenLabsAgent(organization: any) {
  // Append (local) to agent name if running in local environment
  const isLocal = SUPABASE_URL?.includes('localhost') || SUPABASE_URL?.includes('127.0.0.1');
  const localSuffix = isLocal ? ' (local)' : '';

  const agentConfig = {
    name: `${organization.name} AI Assistant${localSuffix}`,
    conversation_config: {
      agent: {
        prompt: {
          prompt: `You are a friendly AI receptionist for ${organization.name}, a professional HVAC and plumbing service company.

Your responsibilities:
1. Greet callers warmly and introduce yourself
2. Ask how you can help them today
3. Gather information about their issue (what's wrong, urgency level, location in building)
4. Collect their contact information (name, phone, address)
5. Help schedule appointments during business hours
6. Handle emergencies by noting them as urgent and assuring immediate dispatch

Keep your responses SHORT and conversational - this is a phone call. 2-3 sentences max.
Be warm, professional, and helpful. Use natural speech patterns.

Emergency keywords to watch for: gas leak, flooding, no heat in freezing weather, no cooling in extreme heat, electrical issues, burst pipes.

Business hours: ${organization.business_hours_start || '8:00 AM'} to ${organization.business_hours_end || '5:00 PM'}
Phone: ${organization.phone || 'Available during business hours'}
Service areas: ${organization.service_areas || 'Local area'}

When you have gathered enough information (name, phone, address, issue description), summarize the appointment details and confirm with the caller before ending the call.

Always end calls professionally by thanking them for choosing ${organization.name} and confirming next steps.`
        }
      },
      language: "en"
    },
    platform_settings: {
      widget: {
        avatar: {
          type: "orb"
        }
      }
    }
  };

  try {
    console.log(`Creating ElevenLabs agent for ${organization.name}...`);
    
    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const agentData = await response.json();
    console.log(`✅ Created agent ${agentData.agent_id} for ${organization.name}`);
    
    return agentData.agent_id;
  } catch (error) {
    console.error(`❌ Failed to create agent for ${organization.name}:`, error.message);
    return null;
  }
}

async function updateOrganizationWithAgent(organizationId: string, agentId: string) {
  try {
    const { error } = await supabase
      .from('organizations')
      .update({ 
        elevenlabs_agent_id: agentId,
        updated_at: new Date().toISOString()
      })
      .eq('id', organizationId);

    if (error) {
      throw error;
    }

    console.log(`✅ Updated organization ${organizationId} with agent ${agentId}`);
  } catch (error) {
    console.error(`❌ Failed to update organization ${organizationId}:`, error.message);
  }
}

async function main() {
  const args = Deno.args;
  let organizationId: string | null = null;

  if (args.length > 0) {
    organizationId = args[0];
    console.log(`Setting up ElevenLabs agent for organization: ${organizationId}`);
  } else {
    console.log('Setting up ElevenLabs agents for all organizations without agents...');
  }

  try {
    // Get organizations that need agents
    let query = supabase
      .from('organizations')
      .select('*')
      .is('elevenlabs_agent_id', null);

    if (organizationId) {
      query = query.eq('id', organizationId);
    }

    const { data: organizations, error } = await query;

    if (error) {
      throw error;
    }

    if (!organizations || organizations.length === 0) {
      console.log('No organizations found that need ElevenLabs agents.');
      return;
    }

    console.log(`Found ${organizations.length} organization(s) to set up:`);
    organizations.forEach(org => {
      console.log(`- ${org.name} (${org.id})`);
    });

    console.log('\nStarting agent creation...\n');

    for (const org of organizations) {
      const agentId = await createElevenLabsAgent(org);
      
      if (agentId) {
        await updateOrganizationWithAgent(org.id, agentId);
        console.log(`🎉 Successfully set up agent for ${org.name}\n`);
      } else {
        console.log(`⚠️  Skipping database update for ${org.name} due to agent creation failure\n`);
      }

      // Rate limiting - wait 1 second between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Agent setup complete!');

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}