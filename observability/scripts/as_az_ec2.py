import boto3
from tabulate import tabulate

def get_asg_distribution():
    """
    Get instance distribution across AZs for all Auto Scaling groups
    """
    asg_client = boto3.client('autoscaling')
    asg_distributions = []

    try:
        # Get list of all Auto Scaling groups
        paginator = asg_client.get_paginator('describe_auto_scaling_groups')
        
        for page in paginator.paginate():
            for asg in page['AutoScalingGroups']:
                asg_name = asg['AutoScalingGroupName']
                
                # Initialize AZ distribution counter
                az_distribution = {}
                total_instances = 0

                # Count instances per AZ
                for instance in asg['Instances']:
                    if 'AvailabilityZone' in instance:
                        az = instance['AvailabilityZone']
                        total_instances += 1

                # Create distribution info
                asg_info = {
                    'ASG Name': asg_name,
                    'Total Instances': total_instances,
                    'Desired Capacity': asg['DesiredCapacity'],
                    'Min Size': asg['MinSize'],
                    'Max Size': asg['MaxSize'],
                    'AZ Distribution': az_distribution
                }
                
                asg_distributions.append(asg_info)

        return asg_distributions

    except Exception as e:
        print(f"Error collecting ASG information: {str(e)}")
        raise

def main():
    try:
        asg_distributions = get_asg_distribution()
        
        if not asg_distributions:
            print("No Auto Scaling groups found.")
            return

        # Prepare data for summary table
        summary_data = []
        
        for asg in asg_distributions:
            # Create AZ distribution string
            az_dist = []
            for az, count in asg['AZ Distribution'].items():
                az_dist.append(f"{az}: {count}")
            
            summary_data.append([
                asg['ASG Name'],
                asg['Total Instances'],
                asg['Desired Capacity'],
                asg['Min Size'],
                asg['Max Size'],
                '\n'.join(az_dist) if az_dist else 'No instances'
            ])

        # Print summary table
        headers = ['ASG Name', 'Total Instances', 'Desired', 'Min', 'Max', 'AZ Distribution']
        print("\nAuto Scaling Groups Distribution Summary:")
        print(tabulate(summary_data, headers=headers, tablefmt='grid'))

        # Print total instances across all ASGs
        total_instances = sum(asg['Total Instances'] for asg in asg_distributions)
        print(f"\nTotal instances across all Auto Scaling groups: {total_instances}")

    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()
