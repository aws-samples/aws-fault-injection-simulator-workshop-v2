"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cloud9Environment = void 0;
const constructs_1 = require("constructs");
const cloudformation_include = require("aws-cdk-lib/cloudformation-include");
class Cloud9Environment extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const template = new cloudformation_include.CfnInclude(this, 'Cloud9Template', {
            templateFile: props.templateFile,
            parameters: {
                'CreateVPC': false,
                'Cloud9VPC': props.vpcId,
                'Cloud9Subnet': props.subnetId
            },
            preserveLogicalIds: false
        });
        if (props.name) {
            template.getParameter("EnvironmentName").default = props.name;
        }
        if (props.cloud9OwnerArn) {
            template.getParameter("Cloud9OwnerRole").default = props.cloud9OwnerArn.valueOf();
        }
        this.c9Role = template.getResource("C9Role");
    }
}
exports.Cloud9Environment = Cloud9Environment;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWQ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2xvdWQ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDJDQUF1QztBQUN2Qyw2RUFBNkU7QUFXN0UsTUFBYSxpQkFBa0IsU0FBUSxzQkFBUztJQUU1QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTZCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxRQUFRLEdBQUcsSUFBSyxzQkFBc0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzVFLFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWTtZQUNoQyxVQUFVLEVBQUU7Z0JBQ1IsV0FBVyxFQUFFLEtBQUs7Z0JBQ2xCLFdBQVcsRUFBRSxLQUFLLENBQUMsS0FBSztnQkFDeEIsY0FBYyxFQUFFLEtBQUssQ0FBQyxRQUFRO2FBQ2pDO1lBQ0Qsa0JBQWtCLEVBQUUsS0FBSztTQUM1QixDQUFDLENBQUM7UUFFSCxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNiLFFBQVEsQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztRQUNsRSxDQUFDO1FBRUQsSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDdkIsUUFBUSxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3RGLENBQUM7UUFFRCxJQUFJLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFZLENBQUM7SUFFNUQsQ0FBQztDQUNKO0FBMUJELDhDQTBCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgKiBhcyBjbG91ZGZvcm1hdGlvbl9pbmNsdWRlIGZyb20gXCJhd3MtY2RrLWxpYi9jbG91ZGZvcm1hdGlvbi1pbmNsdWRlXCI7XG5pbXBvcnQgeyBDZm5Sb2xlIH0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcblxuZXhwb3J0IGludGVyZmFjZSBDbG91ZDlFbnZpcm9ubWVudFByb3BzIHtcbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIHZwY0lkOiBzdHJpbmc7XG4gICAgc3VibmV0SWQ6IHN0cmluZztcbiAgICB0ZW1wbGF0ZUZpbGU6IHN0cmluZztcbiAgICBjbG91ZDlPd25lckFybj86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIENsb3VkOUVudmlyb25tZW50IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgICBwdWJsaWMgcmVhZG9ubHkgYzlSb2xlOiBDZm5Sb2xlO1xuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDbG91ZDlFbnZpcm9ubWVudFByb3BzKSB7XG4gICAgICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBuZXcgIGNsb3VkZm9ybWF0aW9uX2luY2x1ZGUuQ2ZuSW5jbHVkZSh0aGlzLCAnQ2xvdWQ5VGVtcGxhdGUnLCB7XG4gICAgICAgICAgICB0ZW1wbGF0ZUZpbGU6IHByb3BzLnRlbXBsYXRlRmlsZSxcbiAgICAgICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ3JlYXRlVlBDJzogZmFsc2UsXG4gICAgICAgICAgICAgICAgJ0Nsb3VkOVZQQyc6IHByb3BzLnZwY0lkLFxuICAgICAgICAgICAgICAgICdDbG91ZDlTdWJuZXQnOiBwcm9wcy5zdWJuZXRJZFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByZXNlcnZlTG9naWNhbElkczogZmFsc2VcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHByb3BzLm5hbWUpIHtcbiAgICAgICAgICAgIHRlbXBsYXRlLmdldFBhcmFtZXRlcihcIkVudmlyb25tZW50TmFtZVwiKS5kZWZhdWx0ID0gcHJvcHMubmFtZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcm9wcy5jbG91ZDlPd25lckFybikge1xuICAgICAgICAgICAgdGVtcGxhdGUuZ2V0UGFyYW1ldGVyKFwiQ2xvdWQ5T3duZXJSb2xlXCIpLmRlZmF1bHQgPSBwcm9wcy5jbG91ZDlPd25lckFybi52YWx1ZU9mKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmM5Um9sZSA9IHRlbXBsYXRlLmdldFJlc291cmNlKFwiQzlSb2xlXCIpIGFzIENmblJvbGU7XG5cbiAgICB9XG59Il19